import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db() -> None:
    """Initialize database, enable pgvector extension, and create tables."""
    try:
        async with engine.begin() as conn:
            # Enable the pgvector extension if not already enabled
            logger.info("Ensuring pgvector extension is enabled...")
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            
            # Create all tables defined in models
            logger.info("Creating database tables...")
            await conn.run_sync(Base.metadata.create_all)
            # Additive migration for databases created before embedding provenance was tracked.
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_provider VARCHAR(50) NOT NULL DEFAULT 'fastembed';"))
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(255) NOT NULL DEFAULT 'BAAI/bge-small-en-v1.5';"))
            logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise e

