import json
import uuid
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app.models.chat import Conversation, ChatMessage
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatMessageResponse,
    ConversationResponse,
    ConversationListResponse,
    CitationSource
)
from app.services.rag_service import RAGService

router = APIRouter(prefix="/chat", tags=["Chat & RAG"])
logger = logging.getLogger(__name__)

async def get_or_create_conversation(db: AsyncSession, conversation_id: Optional[str], initial_title: str = "New Chat") -> Conversation:
    if conversation_id:
        stmt = select(Conversation).where(Conversation.id == conversation_id)
        result = await db.execute(stmt)
        conv = result.scalar_one_or_none()
        if conv:
            return conv

    # Create new conversation
    new_conv = Conversation(
        id=conversation_id or uuid.uuid4().hex,
        title=initial_title[:50]
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)
    return new_conv

@router.post("", response_model=ChatResponse)
async def chat_query(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Standard (non-streaming) RAG query. Retrieves document chunks, calls LLM, and saves conversation.
    """
    # 1. Retrieve or create conversation
    title = request.message[:40] + ("..." if len(request.message) > 40 else "")
    conv = await get_or_create_conversation(db, request.conversation_id, initial_title=title)

    # 2. Retrieve relevant context via Vector Store
    sources = [] if RAGService.is_standalone_greeting(request.message) else await RAGService.retrieve_context(
        db=db,
        query=request.message,
        document_ids=request.document_ids,
        top_k=request.top_k or 5
    )
    sources = RAGService.select_relevant_sources(sources)
    display_sources = RAGService.group_sources_by_document(sources)

    # 3. Assemble Prompt
    system_msg, user_prompt = RAGService.build_context_prompt(
        query=request.message,
        sources=sources,
        custom_system=request.system_prompt
    )

    # 4. Generate answer
    full_response_text = ""
    async for token in RAGService.query_llm_stream(
        system_msg=system_msg,
        user_prompt=user_prompt,
        provider=request.provider,
        model=request.model,
        temperature=request.temperature or 0.2
    ):
        full_response_text += token

    # 5. Persist user message and assistant response
    user_msg = ChatMessage(
        conversation_id=conv.id,
        role="user",
        content=request.message,
        citations=[]
    )
    db.add(user_msg)

    assistant_msg = ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content=full_response_text,
        citations=[s.dict() for s in display_sources]
    )
    db.add(assistant_msg)

    conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conv.id,
        message=ChatMessageResponse(
            id=assistant_msg.id,
            conversation_id=conv.id,
            role="assistant",
            content=full_response_text,
            citations=display_sources,
            created_at=assistant_msg.created_at
        ),
        sources=display_sources
    )

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Streaming RAG endpoint with Server-Sent Events (SSE).
    Sends 'sources' event first, followed by 'token' events, and finishes with 'done'.
    """
    # Ensure conversation exists
    title = request.message[:40] + ("..." if len(request.message) > 40 else "")
    conv = await get_or_create_conversation(db, request.conversation_id, initial_title=title)
    conv_id = conv.id

    async def sse_event_generator():
        try:
            # Step 1: Retrieve context using standard embedding provider
            sources = [] if RAGService.is_standalone_greeting(request.message) else await RAGService.retrieve_context(
                db=db,
                query=request.message,
                document_ids=request.document_ids,
                top_k=request.top_k or 5
            )
            sources = RAGService.select_relevant_sources(sources)
            display_sources = RAGService.group_sources_by_document(sources)

            system_msg, user_prompt = RAGService.build_context_prompt(
                query=request.message,
                sources=sources,
                custom_system=request.system_prompt
            )

            # Expose the retrieved chunks and assembled prompts for the debugger.
            diagnostics_payload = {
                "query": request.message,
                "provider": request.provider or "default",
                "model": request.model or "default",
                "temperature": request.temperature if request.temperature is not None else 0.2,
                "top_k": request.top_k or 5,
                "document_ids": request.document_ids,
                "retrieved_chunks": [s.dict() for s in sources],
                "system_prompt": system_msg,
                "user_prompt": user_prompt,
            }
            yield f"event: diagnostics\ndata: {json.dumps(diagnostics_payload)}\n\n"

            # Step 2: Send retrieved sources event
            sources_payload = [s.dict() for s in display_sources]
            yield f"event: sources\ndata: {json.dumps({'conversation_id': conv_id, 'sources': sources_payload})}\n\n"

            accumulated_text = ""
            # Step 3: Stream tokens from LLM
            async for token in RAGService.query_llm_stream(
                system_msg=system_msg,
                user_prompt=user_prompt,
                provider=request.provider,
                model=request.model,
                temperature=request.temperature or 0.2
            ):
                accumulated_text += token
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"

            # Step 4: Save to database in separate session
            async with AsyncSessionLocal() as save_db:
                user_msg = ChatMessage(
                    conversation_id=conv_id,
                    role="user",
                    content=request.message,
                    citations=[]
                )
                assistant_msg = ChatMessage(
                    conversation_id=conv_id,
                    role="assistant",
                    content=accumulated_text,
                    citations=sources_payload
                )
                save_db.add(user_msg)
                save_db.add(assistant_msg)
                await save_db.commit()

            # Step 5: Emit done event
            yield f"event: done\ndata: {json.dumps({'conversation_id': conv_id, 'status': 'completed'})}\n\n"

        except Exception as e:
            logger.error(f"Error in SSE stream: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """List all previous conversations ordered by most recent."""
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .order_by(desc(Conversation.updated_at))
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()
    return ConversationListResponse(conversations=conversations)

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch complete conversation thread with all messages and citations."""
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conv

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a conversation and all its messages."""
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.commit()
    return {"message": "Conversation deleted successfully", "id": conversation_id}

