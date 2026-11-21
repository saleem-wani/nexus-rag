from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class DocumentChunkResponse(BaseModel):
    id: str
    chunk_index: int
    content: str
    chunk_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    embedding_provider: str
    embedding_model: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkResponse] = []

class DocumentListResponse(BaseModel):
    total: int
    documents: List[DocumentResponse]

