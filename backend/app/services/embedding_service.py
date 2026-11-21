import logging
from typing import List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    _fastembed_model = None

    @staticmethod
    def model_for_provider(provider: Optional[str] = None) -> str:
        active_provider = (provider or settings.DEFAULT_EMBEDDING_PROVIDER).lower()
        if active_provider == "openai":
            return settings.EMBEDDING_MODEL if "embedding" in settings.EMBEDDING_MODEL else "text-embedding-3-small"
        if active_provider == "gemini":
            return "text-embedding-004"
        if active_provider == "ollama":
            return settings.EMBEDDING_MODEL or "nomic-embed-text"
        return settings.EMBEDDING_MODEL

    @classmethod
    def get_fastembed_model(cls):
        if cls._fastembed_model is None:
            try:
                from fastembed import TextEmbedding
                logger.info(f"Loading local FastEmbed model: {settings.EMBEDDING_MODEL}")
                cls._fastembed_model = TextEmbedding(model_name=settings.EMBEDDING_MODEL)
                logger.info("FastEmbed model loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load FastEmbed model: {e}")
                raise e
        return cls._fastembed_model

    @classmethod
    async def embed_texts(
        cls,
        texts: List[str],
        provider: Optional[str] = None
    ) -> List[List[float]]:
        """Generates embeddings for a list of texts using the selected or configured provider."""
        if not texts:
            return []

        active_provider = (provider or settings.DEFAULT_EMBEDDING_PROVIDER).lower()

        if active_provider == "openai" or (active_provider == "auto" and settings.OPENAI_API_KEY):
            return await cls._embed_openai(texts)
        elif active_provider == "gemini" or (active_provider == "auto" and settings.GEMINI_API_KEY):
            return await cls._embed_gemini(texts)
        elif active_provider == "ollama":
            return await cls._embed_ollama(texts)
        else:
            # Default to fastembed (local, fast, no external API key required)
            return await cls._embed_fastembed(texts)

    @classmethod
    async def embed_query(cls, text: str, provider: Optional[str] = None) -> List[float]:
        """Generates embedding for a single query text."""
        embeddings = await cls.embed_texts([text], provider=provider)
        if not embeddings:
            raise ValueError("Failed to generate embedding for query")
        return embeddings[0]

    @classmethod
    async def _embed_fastembed(cls, texts: List[str]) -> List[List[float]]:
        """Embeds texts using local FastEmbed ONNX model."""
        try:
            model = cls.get_fastembed_model()
            # fastembed.embed returns a generator of numpy arrays
            embeddings = list(model.embed(texts))
            return [emb.tolist() for emb in embeddings]
        except Exception as e:
            logger.error(f"FastEmbed embedding error: {e}")
            raise RuntimeError(f"Local FastEmbed embedding failed: {str(e)}")

    @classmethod
    async def _embed_openai(cls, texts: List[str]) -> List[List[float]]:
        """Embeds texts using OpenAI API."""
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")

        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )

        try:
            # OpenAI accepts batch of inputs
            response = await client.embeddings.create(
                model=settings.EMBEDDING_MODEL if "embedding" in settings.EMBEDDING_MODEL else "text-embedding-3-small",
                input=texts,
                dimensions=settings.EMBEDDING_DIMENSION
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise RuntimeError(f"OpenAI embedding failed: {str(e)}")

    @classmethod
    async def _embed_gemini(cls, texts: List[str]) -> List[List[float]]:
        """Embeds texts using Google Gemini API."""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={settings.GEMINI_API_KEY}"
        requests_payload = [
            {"model": "models/text-embedding-004", "content": {"parts": [{"text": t}]}}
            for t in texts
        ]

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json={"requests": requests_payload})
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API returned {resp.status_code}: {resp.text}")
            data = resp.json()
            return [item["values"] for item in data.get("embeddings", [])]

    @classmethod
    async def _embed_ollama(cls, texts: List[str]) -> List[List[float]]:
        """Embeds texts using local Ollama instance."""
        embeddings = []
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/embeddings"
        model_name = settings.EMBEDDING_MODEL if settings.EMBEDDING_MODEL else "nomic-embed-text"

        async with httpx.AsyncClient(timeout=60.0) as client:
            for text in texts:
                resp = await client.post(url, json={"model": model_name, "prompt": text})
                if resp.status_code != 200:
                    raise RuntimeError(f"Ollama returned {resp.status_code}: {resp.text}")
                embeddings.append(resp.json().get("embedding", []))
        return embeddings

