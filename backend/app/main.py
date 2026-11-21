import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("nexus-rag")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Nexus RAG backend...")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Initialize database tables and pgvector extension
    try:
        await init_db()
        logger.info("Database connection and pgvector extension successfully verified.")
    except Exception as e:
        logger.warning(f"Database initialization warning (will retry on incoming requests if DB starting): {e}")

    yield

    logger.info("Nexus RAG backend shutting down.")

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-ready Retrieval-Augmented Generation (RAG) platform powered by FastAPI, PostgreSQL (pgvector), and React.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_PREFIX
    }

