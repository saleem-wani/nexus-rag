import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.database import Base
from app.config import settings

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: uuid.uuid4().hex)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    embedding_provider = Column(String(50), nullable=False, default="fastembed")
    embedding_model = Column(String(255), nullable=False, default="BAAI/bge-small-en-v1.5")
    file_size = Column(Integer, nullable=False, default=0)
    file_path = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=lambda: uuid.uuid4().hex)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chunk_metadata = Column(JSON, nullable=True, default=dict)
    embedding = Column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="chunks")

