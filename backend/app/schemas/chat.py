from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class CitationSource(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    content: str
    similarity_score: float
    metadata: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    citations: Optional[List[CitationSource]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[ChatMessageResponse]] = None

    class Config:
        from_attributes = True

class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1, description="The user query or prompt")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional list of document IDs to restrict retrieval to")
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    provider: Optional[str] = None  # "openai", "gemini", "ollama"
    model: Optional[str] = None
    temperature: Optional[float] = Field(default=0.2, ge=0.0, le=1.0)
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessageResponse
    sources: List[CitationSource]

