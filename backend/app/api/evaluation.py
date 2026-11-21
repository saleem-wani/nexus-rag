import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.evaluation import (
    EvaluationCaseResult,
    EvaluationRunRequest,
    EvaluationRunResponse,
)
from app.services.rag_service import RAGService

router = APIRouter(prefix="/evaluation", tags=["RAG Evaluation"])
logger = logging.getLogger(__name__)


def _matches_expected(source_name: str, expected: List[str]) -> bool:
    normalized = source_name.strip().casefold()
    return any(normalized == item.strip().casefold() for item in expected)


def _make_evaluator(provider: str, model: Optional[str]):
    """Create a RAGAS judge using the provider's OpenAI-compatible endpoint."""
    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise HTTPException(status_code=503, detail="RAGAS evaluation with OpenAI requires OPENAI_API_KEY.")
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_BASE_URL
        judge_model = model or settings.OPENAI_MODEL
    elif provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="RAGAS evaluation with Gemini requires GEMINI_API_KEY.")
        api_key = settings.GEMINI_API_KEY
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        judge_model = model or settings.GEMINI_MODEL
    elif provider == "ollama":
        api_key = "ollama"
        base_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/v1"
        judge_model = model or settings.OLLAMA_MODEL
    else:
        raise HTTPException(status_code=400, detail="RAGAS evaluator provider must be openai, gemini, or ollama.")

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    from ragas.llms import llm_factory
    evaluator_llm = llm_factory(judge_model, provider="openai", client=client)
    return client, evaluator_llm


@router.post("/run", response_model=EvaluationRunResponse)
async def run_evaluation(
    request: EvaluationRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run a golden set through RAG and score it with RAGAS; no chat history is saved."""
    evaluator_provider = (
        request.evaluator_provider or request.provider or settings.DEFAULT_LLM_PROVIDER
    ).lower()
    if evaluator_provider == "auto":
        evaluator_provider = (
            "openai" if settings.OPENAI_API_KEY
            else "gemini" if settings.GEMINI_API_KEY
            else "ollama"
        )
    client, evaluator_llm = _make_evaluator(
        evaluator_provider,
        request.evaluator_model or request.model,
    )

    try:
        from ragas.metrics.collections import ContextPrecision, ContextRecall, Faithfulness

        faithfulness_metric = Faithfulness(llm=evaluator_llm)
        precision_metric = ContextPrecision(llm=evaluator_llm)
        recall_metric = ContextRecall(llm=evaluator_llm)

        results: List[EvaluationCaseResult] = []
        for case in request.cases:
            try:
                raw_sources = await RAGService.retrieve_context(
                    db=db,
                    query=case.question,
                    document_ids=request.document_ids,
                    top_k=request.top_k,
                )
                ranked_documents = RAGService.group_sources_by_document(raw_sources)
                ranked_documents.sort(key=lambda source: source.similarity_score, reverse=True)
                retrieved_names = [source.filename for source in ranked_documents]
                relevant_ranks = [
                    index for index, source in enumerate(ranked_documents, start=1)
                    if _matches_expected(source.filename, case.expected_documents)
                    or _matches_expected(source.document_id, case.expected_documents)
                ]

                answer_contexts = RAGService.select_relevant_sources(raw_sources)
                display_sources = RAGService.group_sources_by_document(answer_contexts)
                system_msg, user_prompt = RAGService.build_context_prompt(
                    query=case.question,
                    sources=answer_contexts,
                )

                answer_text = ""
                async for token in RAGService.query_llm_stream(
                    system_msg=system_msg,
                    user_prompt=user_prompt,
                    provider=request.provider,
                    model=request.model,
                    temperature=request.temperature,
                ):
                    answer_text += token

                retrieved_contexts = [source.content for source in raw_sources]
                answer_context_texts = [source.content for source in answer_contexts]
                if retrieved_contexts:
                    precision = (await precision_metric.ascore(
                        user_input=case.question,
                        reference=case.reference,
                        retrieved_contexts=retrieved_contexts,
                    )).value
                    recall = (await recall_metric.ascore(
                        user_input=case.question,
                        reference=case.reference,
                        retrieved_contexts=retrieved_contexts,
                    )).value
                else:
                    precision = 0.0
                    recall = 0.0
                faithfulness = (await faithfulness_metric.ascore(
                    user_input=case.question,
                    response=answer_text,
                    retrieved_contexts=answer_context_texts,
                )).value if answer_context_texts else 0.0

                results.append(EvaluationCaseResult(
                    question=case.question,
                    expected_documents=case.expected_documents,
                    retrieved_documents=retrieved_names,
                    answer_sources=[source.filename for source in display_sources],
                    retrieval_hit=bool(relevant_ranks) if case.expected_documents else None,
                    faithfulness=float(faithfulness),
                    context_precision=float(precision),
                    context_recall=float(recall),
                    answer=answer_text,
                ))
            except Exception as exc:
                logger.exception("RAGAS evaluation failed for question: %s", case.question)
                results.append(EvaluationCaseResult(
                    question=case.question,
                    expected_documents=case.expected_documents,
                    retrieved_documents=[],
                    answer_sources=[],
                    retrieval_hit=False if case.expected_documents else None,
                    error=str(exc),
                ))

        def mean(metric_name: str) -> Optional[float]:
            scores = [getattr(item, metric_name) for item in results if getattr(item, metric_name) is not None]
            return sum(scores) / len(scores) if scores else None

        hit_scores = [item.retrieval_hit for item in results if item.retrieval_hit is not None]
        return EvaluationRunResponse(
            case_count=len(results),
            retrieval_hit_rate=(sum(hit_scores) / len(hit_scores)) if hit_scores else None,
            mean_faithfulness=mean("faithfulness"),
            mean_context_precision=mean("context_precision"),
            mean_context_recall=mean("context_recall"),
            results=results,
        )
    finally:
        await client.close()
