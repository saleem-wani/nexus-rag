import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Nexus RAG"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    # Database (PostgreSQL with pgvector)
    # Default to docker host port 5434 or internal postgres container 5432
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/nexus_rag"

    # Embeddings & Dimensions
    # Providers: "fastembed" (local CPU, 384 dim), "openai" (1536 dim), "gemini" (768 dim), "ollama" (768 dim)
    DEFAULT_EMBEDDING_PROVIDER: str = "fastembed"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = 384

    # LLM Settings
    # Providers: "openai", "gemini", "ollama"
    DEFAULT_LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: Optional[str] = None

    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # RAG Settings
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    TOP_K_RESULTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.2
    SOURCE_RELEVANCE_MARGIN: float = 0.1

    # Storage
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_FILE_SIZE: int = 25 * 1024 * 1024
    MAX_UPLOAD_BATCH_SIZE: int = 100 * 1024 * 1024
    MAX_UPLOAD_FILES: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

