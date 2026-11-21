import React from 'react';
import { Activity, CheckCircle2, CircleDashed, Database, FileText, Terminal } from 'lucide-react';
import { RagDiagnostics } from '../types';

export interface RagDebugRun {
  id: string;
  query: string;
  status: 'retrieving' | 'generating' | 'completed' | 'error';
  answer: string;
  startedAt: string;
  diagnostics?: RagDiagnostics;
  error?: string;
}

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; badge?: string }> = ({ title, icon, children, badge }) => (
  <section className="rounded-xl border border-[#2b2d30] bg-[#151719] overflow-hidden">
    <div className="flex items-center justify-between border-b border-[#282a2c] px-4 py-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-[#e3e3e3]">{icon}{title}</h3>
      {badge && <span className="text-[11px] text-[#8e918f]">{badge}</span>}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export const RagDebugView: React.FC<{ runs: RagDebugRun[] }> = ({ runs }) => {
  const run = runs[0];
  if (!run) return (
    <div className="flex-1 overflow-y-auto bg-[#0f1113] p-6 md:p-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-dashed border-[#333537] p-10 text-center">
        <Activity className="mx-auto mb-3 h-8 w-8 text-[#8ab4f8]" />
        <h2 className="text-lg font-medium text-white">RAG pipeline debugger</h2>
        <p className="mt-2 text-sm text-[#9aa0a6]">Send a message in Chat to inspect retrieval, prompt assembly, and the generated answer here.</p>
      </div>
    </div>
  );

  const diag = run.diagnostics;
  const steps = [
    { label: 'Query received', done: true },
    { label: 'Context retrieved', done: !!diag },
    { label: 'Prompt assembled', done: !!diag },
    { label: run.status === 'error' ? 'Generation failed' : 'Answer generated', done: run.status === 'completed' || run.status === 'error' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1113] p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8ab4f8]">Pipeline trace</p>
            <h2 className="mt-1 text-xl font-medium text-white">RAG Debugger</h2>
          </div>
          <span className="rounded-full border border-[#333537] bg-[#1b1d1f] px-3 py-1 text-xs text-[#c4c7c5]">
            {runs.length} {runs.length === 1 ? 'run' : 'runs'} · showing latest
          </span>
        </div>

        <Panel title="1. Input" icon={<Terminal className="h-4 w-4 text-[#8ab4f8]" />}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-white">{run.query}</p>
          <p className="mt-3 text-[11px] text-[#777b80]">{new Date(run.startedAt).toLocaleString()}</p>
        </Panel>

        <Panel title="2. Pipeline steps" icon={<Activity className="h-4 w-4 text-[#81c995]" />}>
          <div className="grid gap-2 sm:grid-cols-4">
            {steps.map((step, index) => <div key={step.label} className="flex items-center gap-2 rounded-lg bg-[#1d2022] px-3 py-2.5 text-xs text-[#c4c7c5]">
              {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#81c995]" /> : <CircleDashed className="h-4 w-4 shrink-0 text-[#777b80]" />}
              <span><b className="mr-1 text-[#777b80]">{index + 1}.</b>{step.label}</span>
            </div>)}
          </div>
          {run.status === 'error' && <p className="mt-3 text-sm text-red-300">{run.error}</p>}
          {!diag && <p className="mt-3 text-xs text-[#9aa0a6]">Waiting for retrieval diagnostics…</p>}
        </Panel>

        <Panel title="3. Retrieved context" icon={<Database className="h-4 w-4 text-[#fdd663]" />} badge={diag ? `${diag.retrieved_chunks.length} chunks · top ${diag.top_k}` : 'waiting'}>
          {diag && <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[#9aa0a6]">
            <span className="rounded bg-[#202326] px-2 py-1">Provider: {diag.provider}</span><span className="rounded bg-[#202326] px-2 py-1">Model: {diag.model}</span>
            <span className="rounded bg-[#202326] px-2 py-1">Temperature: {diag.temperature}</span><span className="rounded bg-[#202326] px-2 py-1">Scope: {diag.document_ids?.length ? `${diag.document_ids.length} selected docs` : 'all documents'}</span>
          </div>}
          {!diag && <p className="text-xs text-[#777b80]">Context will appear when retrieval finishes.</p>}
          {diag?.retrieved_chunks.length === 0 && <p className="text-sm text-[#9aa0a6]">No relevant chunks were retrieved.</p>}
          <div className="space-y-3">
            {diag?.retrieved_chunks.map((chunk, index) => <article key={`${chunk.document_id}-${chunk.chunk_index}-${index}`} className="rounded-lg border border-[#2b2d30] bg-[#101214] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-[#e3e3e3]"><FileText className="h-3.5 w-3.5 text-[#8ab4f8]" />{chunk.filename} · chunk {chunk.chunk_index}{chunk.metadata?.page ? ` · page ${chunk.metadata.page}` : ''}</span>
                <span className="rounded bg-[#263425] px-2 py-0.5 text-[#a8d7b2]">score {chunk.similarity_score.toFixed(4)}</span>
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-[#b8bdc3]">{chunk.content}</pre>
            </article>)}
          </div>
        </Panel>

        <Panel title="4. Assembled prompt" icon={<Terminal className="h-4 w-4 text-[#c58af9]" />}>
          {diag ? <div className="space-y-4">
            <div><p className="mb-1 text-[11px] uppercase tracking-wider text-[#8e918f]">System prompt</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#101214] p-3 text-xs leading-5 text-[#b8bdc3]">{diag.system_prompt}</pre></div>
            <div><p className="mb-1 text-[11px] uppercase tracking-wider text-[#8e918f]">User prompt + retrieved context</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[#101214] p-3 text-xs leading-5 text-[#b8bdc3]">{diag.user_prompt}</pre></div>
          </div> : <p className="text-xs text-[#777b80]">Prompt will appear when retrieval finishes.</p>}
        </Panel>

        <Panel title="5. Final answer" icon={<CheckCircle2 className="h-4 w-4 text-[#81c995]" />} badge={run.status}>
          {run.answer ? <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#e3e3e3]">{run.answer}</pre> : <p className="text-xs text-[#777b80]">{run.status === 'completed' ? 'The model returned an empty answer.' : 'Waiting for answer tokens…'}</p>}
        </Panel>
      </div>
    </div>
  );
};
