import os
import uuid
import aiofiles
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import get_db
from app.config import settings
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse, DocumentDetailResponse, DocumentListResponse
from app.services.rag_service import RAGService
from app.services.embedding_service import EmbeddingService

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".csv", ".json"}

@router.post("/upload", response_model=List[DocumentResponse])
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    provider: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload one or multiple documents. Initiates background ingestion and vector embedding.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    if len(files) > settings.MAX_UPLOAD_FILES:
        raise HTTPException(status_code=413, detail=f"Upload no more than {settings.MAX_UPLOAD_FILES} files at once.")
    if provider and provider.lower() not in {"fastembed", "openai", "gemini", "ollama"}:
        raise HTTPException(status_code=400, detail="Unsupported embedding provider.")
    if provider and provider.lower() != settings.DEFAULT_EMBEDDING_PROVIDER.lower():
        raise HTTPException(status_code=400, detail="Uploads must use the configured default embedding provider.")
    created_documents: List[Document] = []
    batch_size = 0

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
            )

        doc_id = uuid.uuid4().hex
        saved_filename = f"{doc_id}_{file.filename}"
        file_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

        # Save uploaded file
        file_size = 0
        try:
            async with aiofiles.open(file_path, "wb") as out_file:
                while content := await file.read(1024 * 1024):
                    file_size += len(content)
                    batch_size += len(content)
                    if file_size > settings.MAX_UPLOAD_FILE_SIZE or batch_size > settings.MAX_UPLOAD_BATCH_SIZE:
                        raise HTTPException(status_code=413, detail="Upload size limit exceeded.")
                    await out_file.write(content)
        except Exception:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise

        # Create Document record
        doc = Document(
            id=doc_id,
            filename=file.filename,
            file_type=ext.lstrip("."),
            embedding_provider=(provider or settings.DEFAULT_EMBEDDING_PROVIDER).lower(),
            embedding_model=EmbeddingService.model_for_provider(provider),
            file_size=file_size,
            file_path=file_path,
            status="PENDING"
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        created_documents.append(doc)

        # Queue ingestion pipeline
        background_tasks.add_task(
            RAGService.process_document_pipeline,
            db=db,
            document_id=doc.id,
            file_path=file_path,
            filename=file.filename,
            file_type=doc.file_type,
            provider=doc.embedding_provider
        )

    return created_documents

@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List uploaded documents with status and metadata."""
    query = select(Document)
    if status:
        query = query.where(Document.status == status.upper())

    total_query = select(func.count(Document.id))
    if status:
        total_query = total_query.where(Document.status == status.upper())

    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    query = query.order_by(desc(Document.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    docs = result.scalars().all()

    return DocumentListResponse(total=total, documents=docs)

@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Get single document metadata and all its generated text chunks."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch chunks
    chunks_stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)
    chunks_result = await db.execute(chunks_stmt)
    chunks = chunks_result.scalars().all()

    doc_dict = {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "embedding_provider": doc.embedding_provider,
        "embedding_model": doc.embedding_model,
        "file_size": doc.file_size,
        "status": doc.status,
        "error_message": doc.error_message,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "chunks": chunks
    }
    return doc_dict

@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a document, its database record, chunks, embeddings, and raw file."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove stored physical file if exists
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.warning(f"Failed to remove file from disk {doc.file_path}: {e}")

    await db.delete(doc)
    await db.commit()

    return {"message": f"Document '{doc.filename}' deleted successfully", "id": document_id}

@router.post("/{document_id}/reindex")
async def reindex_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    provider: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    """Re-run parsing, chunking, and embedding on an existing document."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=400, detail="Physical file missing on server, cannot re-index.")

    if provider and provider.lower() != settings.DEFAULT_EMBEDDING_PROVIDER.lower():
        raise HTTPException(status_code=400, detail="Reindexing must use the configured default embedding provider.")

    # Delete existing chunks first
    from sqlalchemy import delete
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    doc.status = "PENDING"
    doc.chunk_count = 0
    doc.embedding_provider = settings.DEFAULT_EMBEDDING_PROVIDER.lower()
    doc.embedding_model = EmbeddingService.model_for_provider()
    await db.commit()

    background_tasks.add_task(
        RAGService.process_document_pipeline,
        db=db,
        document_id=doc.id,
        file_path=doc.file_path,
        filename=doc.filename,
        file_type=doc.file_type,
        provider=provider or doc.embedding_provider
    )

    return {"message": "Re-indexing started in background", "id": document_id}

