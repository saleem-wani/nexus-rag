import React, { useState } from 'react';
import { Activity, Loader2, Plus, Trash2, X } from 'lucide-react';
import { EvaluationCaseInput, EvaluationRunResponse, SystemSettings } from '../types';
import { api } from '../api/client';

interface DraftCase {
  id: number;
  question: string;
  reference: string;
  expectedDocuments: string;
}

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  selectedDocIds: string[];
}

const scoreLabel = (value?: number | null) => value == null ? '—' : `${Math.round(value * 100)}%`;

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  isOpen,
  onClose,
  settings,
  selectedDocIds,
}) => {
  const [cases, setCases] = useState<DraftCase[]>([
    { id: 1, question: '', reference: '', expectedDocuments: '' },
  ]);
  const [result, setResult] = useState<EvaluationRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  if (!isOpen) return null;

  const updateCase = (id: number, key: keyof Omit<DraftCase, 'id'>, value: string) => {
    setCases((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  };

  const addCase = () => {
    setCases((current) => [...current, {
      id: Date.now(), question: '', reference: '', expectedDocuments: '',
    }]);
    setResult(null);
    setError(null);
  };

  const runEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    const evaluationCases: EvaluationCaseInput[] = cases.map((item) => ({
      question: item.question.trim(),
      reference: item.reference.trim(),
      expected_documents: item.expectedDocuments.split(',').map((name) => name.trim()).filter(Boolean),
    }));
    if (evaluationCases.some((item) => !item.question || !item.reference)) {
      setError('Each case needs both a question and a reference answer.');
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.runEvaluation({
        cases: evaluationCases,
        topK: settings.topK,
        documentIds: selectedDocIds,
        provider: settings.llmProvider,
        model: settings.model,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed. Check the backend and evaluator configuration.');
    } finally {
      setRunning(false);
    }
  };

  const addMetric = (label: string, value?: number | null) => (
    <div className="rounded-xl border border-[#333537] bg-[#131314] p-3" key={label}>
      <p className="text-[10px] uppercase tracking-wider text-[#8e918f]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#f0f4f9]">{scoreLabel(value)}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="evaluation-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#333537] bg-[#1e1f20] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#282a2c] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#4285f4]/10 p-2 text-[#8ab4f8]"><Activity className="h-5 w-5" /></div>
            <div>
              <h2 id="evaluation-title" className="text-base font-semibold text-[#f0f4f9]">RAG evaluation</h2>
              <p className="text-xs text-[#8e918f]">RAGAS · Faithfulness, Context Precision, Context Recall</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close evaluation" className="rounded-full p-2 text-[#8e918f] hover:bg-[#282a2c] hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          <form onSubmit={runEvaluation} className="space-y-4">
            {cases.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-[#333537] bg-[#171819] p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c4c7c5]">Case {index + 1}</h3>
                  {cases.length > 1 && <button type="button" onClick={() => setCases((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove case ${index + 1}`} className="rounded-lg p-1.5 text-[#8e918f] hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-xs text-[#c4c7c5]">Question</span>
                  <input value={item.question} onChange={(e) => updateCase(item.id, 'question', e.target.value)} maxLength={2000} placeholder="What should the RAG system answer?" className="w-full rounded-xl border border-[#333537] bg-[#101112] px-3 py-2.5 text-sm text-white placeholder:text-[#666a6c] focus:border-[#4285f4] focus:outline-none" />
                </label>
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-xs text-[#c4c7c5]">Reference answer</span>
                  <textarea value={item.reference} onChange={(e) => updateCase(item.id, 'reference', e.target.value)} maxLength={4000} rows={2} placeholder="Your trusted, expected answer for RAGAS to compare against" className="w-full resize-y rounded-xl border border-[#333537] bg-[#101112] px-3 py-2.5 text-sm text-white placeholder:text-[#666a6c] focus:border-[#4285f4] focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-[#c4c7c5]">Expected source files <span className="text-[#777b7d]">(optional, comma separated)</span></span>
                  <input value={item.expectedDocuments} onChange={(e) => updateCase(item.id, 'expectedDocuments', e.target.value)} placeholder="company_policy_handbook.txt" className="w-full rounded-xl border border-[#333537] bg-[#101112] px-3 py-2.5 text-sm text-white placeholder:text-[#666a6c] focus:border-[#4285f4] focus:outline-none" />
                </label>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" disabled={cases.length >= 25} onClick={addCase} className="inline-flex items-center gap-1.5 rounded-full border border-[#3c4043] px-3.5 py-2 text-xs font-medium text-[#c4c7c5] hover:bg-[#282a2c] disabled:opacity-40"><Plus className="h-4 w-4" /> Add case</button>
              <button type="submit" disabled={running} className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1b66ca] disabled:cursor-wait disabled:opacity-60">
                {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</> : 'Run evaluation'}
              </button>
            </div>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-[#8e918f]">Using {settings.llmProvider === 'auto' ? 'automatic provider' : settings.llmProvider} · {settings.model}. RAGAS sends the cases, answers, and retrieved text to the configured evaluator. A run may take a while and use model API credits.</p>

          {error && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

          {result && (
            <section aria-label="Evaluation results" className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {addMetric('Faithfulness', result.mean_faithfulness)}
                {addMetric('Context precision', result.mean_context_precision)}
                {addMetric('Context recall', result.mean_context_recall)}
                {addMetric('Retrieval hit rate', result.retrieval_hit_rate)}
              </div>
              <p className="text-[11px] text-[#8e918f]">Scores are averages across {result.case_count} cases. Higher is better.</p>
              {result.results.map((caseResult, index) => (
                <article key={`${index}-${caseResult.question}`} className="rounded-2xl border border-[#333537] bg-[#171819] p-4 sm:p-5">
                  <h3 className="text-sm font-medium leading-relaxed text-[#f0f4f9]">{caseResult.question}</h3>
                  {caseResult.error ? (
                    <p role="alert" className="mt-3 text-xs text-rose-300">Could not score this case: {caseResult.error}</p>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          ['Faithfulness', caseResult.faithfulness],
                          ['Context precision', caseResult.context_precision],
                          ['Context recall', caseResult.context_recall],
                        ].map(([label, score]) => <div key={String(label)} className="rounded-lg bg-[#101112] px-3 py-2"><p className="text-[10px] text-[#8e918f]">{label}</p><p className="mt-0.5 text-sm font-semibold text-[#c4c7c5]">{scoreLabel(score as number | null | undefined)}</p></div>)}
                      </div>
                      <p className="mt-3 text-xs text-[#8e918f]">Retrieved: {caseResult.retrieved_documents.join(', ') || 'No documents'}</p>
                      <p className="mt-1 text-xs text-[#8e918f]">Used for answer: {caseResult.answer_sources.join(', ') || 'No source context'}</p>
                      {caseResult.answer && <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-[#8ab4f8]">View generated answer</summary><p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#101112] p-3 text-xs leading-relaxed text-[#c4c7c5]">{caseResult.answer}</p></details>}
                    </>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      </section>
    </div>
  );
};
