import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter(tags=["System"])
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check verifying database connection and vector extension."""
    db_status = "unhealthy"
    vector_status = "unavailable"
    
    try:
        # Check basic DB query
        res = await db.execute(text("SELECT 1;"))
        if res.scalar() == 1:
            db_status = "healthy"

        # Check if vector extension is active
        vector_res = await db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
        if vector_res.scalar_one_or_none():
            vector_status = "active"
    except Exception as e:
        logger.error(f"Health check error: {e}")

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "pgvector": vector_status,
        "embedding_provider": settings.DEFAULT_EMBEDDING_PROVIDER,
        "embedding_dimension": settings.EMBEDDING_DIMENSION,
        "default_llm_provider": settings.DEFAULT_LLM_PROVIDER,
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "gemini_configured": bool(settings.GEMINI_API_KEY)
    }

@router.get("/config")
async def get_public_config():
    """Returns safe public configuration options for the frontend."""
    return {
        "appName": settings.APP_NAME,
        "defaultEmbeddingProvider": settings.DEFAULT_EMBEDDING_PROVIDER,
        "embeddingModel": settings.EMBEDDING_MODEL,
        "defaultLlmProvider": settings.DEFAULT_LLM_PROVIDER,
        "openaiConfigured": bool(settings.OPENAI_API_KEY),
        "geminiConfigured": bool(settings.GEMINI_API_KEY),
        "ollamaBaseUrl": settings.OLLAMA_BASE_URL,
        "chunkSize": settings.CHUNK_SIZE,
        "chunkOverlap": settings.CHUNK_OVERLAP,
        "topK": settings.TOP_K_RESULTS
    }

