import { DocumentItem, Conversation, ChatMessage, CitationSource, RagDiagnostics, SystemSettings, EvaluationCaseInput, EvaluationRunResponse } from '../types';

const API_BASE = '/api';

export const api = {
  async runEvaluation({
    cases,
    topK,
    documentIds,
    provider,
    model,
  }: {
    cases: EvaluationCaseInput[];
    topK: number;
    documentIds?: string[];
    provider: SystemSettings['llmProvider'];
    model: string;
  }): Promise<EvaluationRunResponse> {
    const res = await fetch(`${API_BASE}/evaluation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cases,
        top_k: topK,
        document_ids: documentIds?.length ? documentIds : null,
        provider: provider === 'auto' ? null : provider,
        model: model || null,
        evaluator_provider: provider === 'auto' ? null : provider,
        evaluator_model: model || null,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Evaluation request failed' }));
      throw new Error(error.detail || 'Evaluation request failed');
    }
    return await res.json();
  },

  // Document APIs
  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    const data = await res.json();
    return data.documents;
  },

  async getDocumentDetails(id: string): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    if (!res.ok) throw new Error('Failed to fetch document details');
    return await res.json();
  },

  async uploadFiles(files: File[], onProgress?: (progress: number) => void): Promise<DocumentItem[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    return await new Promise<DocumentItem[]>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/documents/upload`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => reject(new Error('Network error while uploading files'));
      request.onload = () => {
        let data: any;
        try { data = JSON.parse(request.responseText); } catch { data = null; }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(data?.detail || 'Upload failed'));
          return;
        }
        resolve(data as DocumentItem[]);
      };
      request.send(formData);
    });
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  // Chat & Conversation APIs
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/chat/conversations`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json();
    return data.conversations;
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return await res.json();
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete conversation');
  },

  // Streaming Chat via Server-Sent Events (SSE)
  async streamChat({
    message,
    conversationId,
    documentIds,
    settings,
    onSources,
    onDiagnostics,
    onToken,
    onDone,
    onError,
    signal,
  }: {
    message: string;
    conversationId?: string;
    documentIds?: string[];
    settings?: SystemSettings;
    onSources: (sources: CitationSource[], convId: string) => void;
    onDiagnostics: (diagnostics: RagDiagnostics) => void;
    onToken: (token: string) => void;
    onDone: (convId: string) => void;
    onError: (err: string) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          document_ids: documentIds && documentIds.length > 0 ? documentIds : null,
          top_k: settings?.topK || 5,
          provider: settings?.llmProvider === 'auto' ? null : settings?.llmProvider,
          model: settings?.model || null,
          temperature: settings?.temperature ?? 0.2,
          system_prompt: settings?.systemPrompt || null,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Chat request failed');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on this browser');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamFinished = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const blockLines = block.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of blockLines) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (eventType === 'diagnostics' && dataStr) {
            onDiagnostics(JSON.parse(dataStr));
          } else if (eventType === 'sources' && dataStr) {
            const parsed = JSON.parse(dataStr);
            onSources(parsed.sources || [], parsed.conversation_id);
          } else if (eventType === 'token' && dataStr) {
            const parsed = JSON.parse(dataStr);
            if (parsed.token) {
              onToken(parsed.token);
            }
          } else if (eventType === 'done' && dataStr) {
            const parsed = JSON.parse(dataStr);
            streamFinished = true;
            onDone(parsed.conversation_id);
          } else if (eventType === 'error' && dataStr) {
            const parsed = JSON.parse(dataStr);
            streamFinished = true;
            onError(parsed.error || 'Unknown error occurred');
          }
        }
      }
      if (!streamFinished && !signal?.aborted) {
        onError('The response stream ended before the answer was complete. Please try again.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Chat stream aborted by user');
      } else {
        onError(err.message || 'Stream connection error');
      }
    }
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  },
};

