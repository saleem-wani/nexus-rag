# Nexus AI Architecture & Platform Specifications

## 1. System Overview
The Nexus AI platform is a distributed, containerized Retrieval-Augmented Generation (RAG) platform. It provides document ingestion, high-dimensional vector search, and LLM-assisted knowledge synthesis.

## 2. Core Components
- **Vector Database**: PostgreSQL 16 with the `pgvector` extension. Chunks are indexed using Hierarchical Navigable Small World (HNSW) and Inverted File Flat (IVFFlat) indexing strategies.
- **Backend API**: High-throughput asynchronous FastAPI engine running Python 3.12.
- **Frontend SPA**: React 18 single-page application built with Vite and Tailwind CSS.
- **Embedding Pipeline**: Uses local CPU FastEmbed (BAAI/bge-small-en-v1.5) by default, generating 384-dimensional dense vectors. It supports pluggable OpenAI and Google Gemini embeddings.

## 3. Retrieval Performance & Metrics
- Ingestion Latency: < 250ms per 10-page document.
- Vector Similarity Query Latency: Average 12ms over 100,000 document chunks using pgvector `<=>` cosine distance.
- Token Streaming Rate: 45 tokens per second via Server-Sent Events (SSE).

## 4. Security & Compliance
- Data Isolation: All documents and vector embeddings are stored strictly within the private PostgreSQL instance.
- No training on user data: Retrievable context is injected as prompt augmentations and is never retained for model retraining.

