import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.document import Document, DocumentChunk
from app.schemas.chat import CitationSource
from app.config import settings
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class VectorStore:
    @staticmethod
    async def add_chunks(
        db: AsyncSession,
        document_id: str,
        chunks_data: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> int:
        """Stores chunks with their corresponding vector embeddings into PostgreSQL."""
        if len(chunks_data) != len(embeddings):
            raise ValueError("Number of chunks must match number of embeddings")

        chunk_models = []
        for chunk, emb in zip(chunks_data, embeddings):
            chunk_models.append(
                DocumentChunk(
                    document_id=document_id,
                    chunk_index=chunk["chunk_index"],
                    content=chunk["content"],
                    chunk_metadata=chunk.get("metadata", {}),
                    embedding=emb
                )
            )

        db.add_all(chunk_models)
        await db.commit()
        return len(chunk_models)

    @staticmethod
    async def similarity_search(
        db: AsyncSession,
        query_embedding: List[float],
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
        min_similarity: float = 0.0
    ) -> List[CitationSource]:
        """
        Performs vector similarity search against PostgreSQL pgvector.
        Returns top matching chunks with document metadata and similarity scores.
        """
        # Cosine distance operator in pgvector is <=>
        # Cosine similarity = 1 - cosine_distance
        cosine_dist = DocumentChunk.embedding.cosine_distance(query_embedding)

        query = (
            select(
                DocumentChunk,
                Document.filename,
                cosine_dist.label("distance")
            )
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                Document.status == "COMPLETED",
                Document.embedding_provider == settings.DEFAULT_EMBEDDING_PROVIDER.lower(),
                Document.embedding_model == EmbeddingService.model_for_provider(),
            )
        )

        if document_ids:
            query = query.where(DocumentChunk.document_id.in_(document_ids))

        # Order by closest distance first
        query = query.order_by(cosine_dist.asc()).limit(top_k)

        result = await db.execute(query)
        rows = result.all()

        citations: List[CitationSource] = []
        for chunk, filename, dist in rows:
            # Cosine distance is between 0 (identical) and 2 (opposite)
            similarity = max(0.0, 1.0 - (float(dist) if dist is not None else 1.0))
            if similarity >= min_similarity:
                citations.append(
                    CitationSource(
                        document_id=chunk.document_id,
                        filename=filename,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        similarity_score=round(similarity, 4),
                        metadata=chunk.chunk_metadata
                    )
                )

        return citations

