import os
import re
import json
import logging
from typing import List, Optional, AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import httpx

from app.config import settings
from app.models.document import Document
from app.models.chat import Conversation, ChatMessage
from app.schemas.chat import CitationSource, ChatRequest
from app.services.document_parser import DocumentParser
from app.services.text_splitter import RecursiveTextSplitter
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are Nexus, an intelligent, helpful, and friendly AI document assistant.

CORE RULES:
1. GREETINGS & PLEASANTRIES:
   - If the user's message is a greeting (e.g. "hi", "hello", "hey", "good morning") or pleasantry, greet them back warmly and ask how you can help them with their documents today.
   - Do NOT say "Based on the uploaded documents, I could not find information..." for simple greetings.

2. DIRECT DOCUMENT ANSWERS:
   - When the user asks a question, answer directly and concisely without repeating self-introductions.
   - Ground your answer strictly in the provided Context excerpts below.
   - Cite the document names when referencing facts (e.g., "[Document: filename]").
   - If the user asks a question about their files and the context does not contain the answer, state: "Based on the uploaded documents, I could not find information about that."

3. FORMATTING:
   - Use clean, well-structured Markdown (bullet points, bold text, code blocks, or tables where appropriate).
   - Be concise, factual, and direct.
"""

class RAGService:
    @staticmethod
    def is_standalone_greeting(query: str) -> bool:
        """Return true for a greeting with no document question attached."""
        normalized = re.sub(r"[^a-z\s']", "", query.lower()).strip()
        return bool(re.fullmatch(
            r"(?:h+i+|hello+|hey+|yo+|good morning|good afternoon|good evening|how are you(?: doing)?)(?: there| again)?",
            normalized,
        ))

    @staticmethod
    def group_sources_by_document(sources: List[CitationSource]) -> List[CitationSource]:
        """Return one representative citation per document, keeping its strongest chunk."""
        best_by_document: Dict[str, CitationSource] = {}
        for source in sources:
            key = source.document_id or source.filename
            current = best_by_document.get(key)
            if current is None or source.similarity_score > current.similarity_score:
                best_by_document[key] = source
        return list(best_by_document.values())

    @staticmethod
    def select_relevant_sources(sources: List[CitationSource]) -> List[CitationSource]:
        """Keep only chunks close to the strongest retrieval match before answering."""
        if not sources:
            return []
        best_score = max(source.similarity_score for source in sources)
        return [
            source for source in sources
            if source.similarity_score >= best_score - settings.SOURCE_RELEVANCE_MARGIN
        ]

    @staticmethod
    async def process_document_pipeline(
        db: AsyncSession,
        document_id: str,
        file_path: str,
        filename: str,
        file_type: str,
        provider: Optional[str] = None
    ) -> None:
        """Complete ingestion pipeline: Parse -> Chunk -> Embed -> Store in Postgres."""
        try:
            logger.info(f"Starting ingestion pipeline for document {document_id} ({filename})")
            
            # Step 1: Update status to PROCESSING
            stmt = update(Document).where(Document.id == document_id).values(status="PROCESSING")
            await db.execute(stmt)
            await db.commit()

            # Step 2: Parse document
            parsed_segments = DocumentParser.parse_file(file_path, filename, file_type)
            if not parsed_segments:
                raise ValueError("No readable text found in document.")

            # Step 3: Chunk text
            splitter = RecursiveTextSplitter(
                chunk_size=settings.CHUNK_SIZE,
                chunk_overlap=settings.CHUNK_OVERLAP
            )
            chunks = splitter.split_documents(parsed_segments)
            if not chunks:
                raise ValueError("Text could not be segmented into chunks.")

            logger.info(f"Generated {len(chunks)} chunks for {filename}")

            # Step 4: Generate Embeddings
            chunk_texts = [c["content"] for c in chunks]
            embeddings = await EmbeddingService.embed_texts(chunk_texts, provider=provider)

            # Step 5: Store Chunks & Vectors in PostgreSQL
            stored_count = await VectorStore.add_chunks(
                db=db,
                document_id=document_id,
                chunks_data=chunks,
                embeddings=embeddings
            )

            # Step 6: Mark document as COMPLETED
            stmt = (
                update(Document)
                .where(Document.id == document_id)
                .values(
                    status="COMPLETED",
                    chunk_count=stored_count,
                    error_message=None
                )
            )
            await db.execute(stmt)
            await db.commit()
            logger.info(f"Document {document_id} successfully indexed with {stored_count} chunks.")

        except Exception as e:
            logger.error(f"Failed pipeline for document {document_id}: {e}", exc_info=True)
            stmt = (
                update(Document)
                .where(Document.id == document_id)
                .values(
                    status="FAILED",
                    error_message=str(e)
                )
            )
            await db.execute(stmt)
            await db.commit()

    @staticmethod
    def build_context_prompt(query: str, sources: List[CitationSource], custom_system: Optional[str] = None) -> tuple[str, str]:
        """Constructs system instruction and augmented user prompt with cited contexts."""
        system_msg = custom_system or SYSTEM_PROMPT_TEMPLATE

        if not sources:
            context_str = "No relevant document excerpts found for this query."
        else:
            context_blocks = []
            for i, src in enumerate(sources, start=1):
                page_info = f", Page {src.metadata.get('page')}" if src.metadata and "page" in src.metadata else ""
                context_blocks.append(
                    f"--- SOURCE [{i}] (File: {src.filename}{page_info}, Score: {src.similarity_score}) ---\n"
                    f"{src.content.strip()}\n"
                )
            context_str = "\n".join(context_blocks)

        user_prompt = (
            f"CONTEXT FROM UPLOADED DOCUMENTS:\n"
            f"================================\n"
            f"{context_str}\n"
            f"================================\n\n"
            f"USER QUERY: {query}\n\n"
            f"Please respond appropriately following the system guidelines."
        )

        return system_msg, user_prompt

    @classmethod
    async def retrieve_context(
        cls,
        db: AsyncSession,
        query: str,
        document_ids: Optional[List[str]] = None,
        top_k: int = 5,
        embedding_provider: Optional[str] = None
    ) -> List[CitationSource]:
        """Generates query embedding and retrieves top-k matching chunks."""
        # Always use the configured embedding provider (e.g. fastembed) to match indexed document dimensions
        provider = embedding_provider or settings.DEFAULT_EMBEDDING_PROVIDER
        query_vector = await EmbeddingService.embed_query(query, provider=provider)
        sources = await VectorStore.similarity_search(
            db=db,
            query_embedding=query_vector,
            top_k=top_k,
            document_ids=document_ids,
            min_similarity=settings.SIMILARITY_THRESHOLD
        )
        return sources

    @classmethod
    async def query_llm_stream(
        cls,
        system_msg: str,
        user_prompt: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[str, None]:
        """Streams LLM tokens from OpenAI, Gemini, Ollama, or fallback."""
        active_provider = (provider or settings.DEFAULT_LLM_PROVIDER).lower()

        if active_provider == "openai" or (active_provider == "auto" and settings.OPENAI_API_KEY):
            async for token in cls._stream_openai(system_msg, user_prompt, model, temperature):
                yield token
        elif active_provider == "gemini" or (active_provider == "auto" and settings.GEMINI_API_KEY):
            async for token in cls._stream_gemini(system_msg, user_prompt, model, temperature):
                yield token
        elif active_provider == "ollama":
            async for token in cls._stream_ollama(system_msg, user_prompt, model, temperature):
                yield token
        else:
            # Fallback if no LLM key is configured yet
            yield "*(Note: No external LLM API key configured yet. Here is the context retrieved from your documents:)*\n\n"
            yield user_prompt

    @classmethod
    async def _stream_openai(
        cls,
        system_msg: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )
        selected_model = model or settings.OPENAI_MODEL

        try:
            stream = await client.chat.completions.create(
                model=selected_model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                stream=True
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"OpenAI stream error: {e}")
            raise RuntimeError(f"OpenAI response generation failed: {e}") from e

    @classmethod
    async def _stream_gemini(
        cls,
        system_msg: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[str, None]:
        selected_model = model or settings.GEMINI_MODEL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{selected_model}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}"

        payload = {
            "system_instruction": {"parts": [{"text": system_msg}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": temperature}
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            try:
                                data = json.loads(data_str)
                                candidates = data.get("candidates", [])
                                if candidates and "content" in candidates[0]:
                                    parts = candidates[0]["content"].get("parts", [])
                                    for p in parts:
                                        if "text" in p:
                                            yield p["text"]
                            except Exception:
                                continue
        except Exception as e:
            logger.error(f"Gemini stream error: {e}")
            raise RuntimeError(f"Gemini response generation failed: {e}") from e

    @classmethod
    async def _stream_ollama(
        cls,
        system_msg: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> AsyncGenerator[str, None]:
        selected_model = model or settings.OLLAMA_MODEL
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"

        payload = {
            "model": selected_model,
            "system": system_msg,
            "prompt": user_prompt,
            "stream": True,
            "options": {"temperature": temperature}
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_bytes = await response.aread()
                        err_msg = err_bytes.decode("utf-8", errors="replace")
                        logger.error(f"Ollama returned {response.status_code}: {err_msg}")
                        yield f"\n\n⚠️ **Ollama Error ({response.status_code}):** {err_msg}\n\n*Tip: Check if model `{selected_model}` is pulled on `{settings.OLLAMA_BASE_URL}` (e.g. `llama3.1:8b`, `mistral:7b`, `qwen2.5:14b`).*"
                        return

                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                if "error" in data:
                                    yield f"\n\n⚠️ **Ollama Error:** {data['error']}"
                                elif "response" in data:
                                    yield data["response"]
                            except Exception:
                                continue
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            raise RuntimeError(f"Ollama response generation failed: {e}") from e

