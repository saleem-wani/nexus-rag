export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  chunk_metadata?: {
    page?: number;
    char_count?: number;
    total_pages?: number;
    [key: string]: any;
  };
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  error_message?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
  chunks?: DocumentChunk[];
}

export interface CitationSource {
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity_score: number;
  metadata?: {
    page?: number;
    char_count?: number;
    [key: string]: any;
  };
}

export interface RagDiagnostics {
  query: string;
  provider: string;
  model: string;
  temperature: number;
  top_k: number;
  document_ids?: string[] | null;
  retrieved_chunks: CitationSource[];
  system_prompt: string;
  user_prompt: string;
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: CitationSource[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface SystemSettings {
  llmProvider: 'openai' | 'gemini' | 'ollama' | 'auto';
  model: string;
  temperature: number;
  topK: number;
  apiKey?: string;
  systemPrompt?: string;
}

export interface EvaluationCaseInput {
  question: string;
  reference: string;
  expected_documents?: string[];
}

export interface EvaluationCaseResult {
  question: string;
  expected_documents: string[];
  retrieved_documents: string[];
  answer_sources: string[];
  retrieval_hit?: boolean | null;
  faithfulness?: number | null;
  context_precision?: number | null;
  context_recall?: number | null;
  answer?: string | null;
  error?: string | null;
}

export interface EvaluationRunResponse {
  case_count: number;
  retrieval_hit_rate?: number | null;
  mean_faithfulness?: number | null;
  mean_context_precision?: number | null;
  mean_context_recall?: number | null;
  results: EvaluationCaseResult[];
}
