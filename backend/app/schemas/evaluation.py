from typing import List, Optional
from pydantic import BaseModel, Field


class EvaluationCase(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    reference: str = Field(..., min_length=1, max_length=4000)
    expected_documents: List[str] = Field(
        default_factory=list,
        description="Optional expected source filenames or document IDs for retrieval hit rate",
    )


class EvaluationRunRequest(BaseModel):
    cases: List[EvaluationCase] = Field(..., min_length=1, max_length=25)
    top_k: int = Field(default=5, ge=1, le=20)
    document_ids: Optional[List[str]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    evaluator_provider: Optional[str] = None
    evaluator_model: Optional[str] = None
    temperature: float = Field(default=0.0, ge=0.0, le=1.0)


class EvaluationCaseResult(BaseModel):
    question: str
    expected_documents: List[str]
    retrieved_documents: List[str]
    answer_sources: List[str]
    retrieval_hit: Optional[bool] = None
    faithfulness: Optional[float] = None
    context_precision: Optional[float] = None
    context_recall: Optional[float] = None
    answer: Optional[str] = None
    error: Optional[str] = None


class EvaluationRunResponse(BaseModel):
    case_count: int
    retrieval_hit_rate: Optional[float] = None
    mean_faithfulness: Optional[float] = None
    mean_context_precision: Optional[float] = None
    mean_context_recall: Optional[float] = None
    results: List[EvaluationCaseResult]
