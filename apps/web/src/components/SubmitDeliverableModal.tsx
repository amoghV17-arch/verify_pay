/**
 * SubmitDeliverableModal — lets a freelancer submit a deliverable for review.
 * Shows live review.progress steps as SSE events arrive.
 * Per DESIGN.md: minimal, keyboard-operable, aria-live for status.
 */
import React, { useState, useEffect, useRef } from 'react';
import { apiRawFetch } from '../lib/api.js';

export type DeliverableKind = 'text' | 'repo' | 'url' | 'image' | 'document';

interface SubmitDeliverableModalProps {
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  deliverableType?: DeliverableKind;
  onClose: () => void;
  onSubmitted?: (deliverableId: string) => void;
}

const KIND_LABELS: Record<DeliverableKind, string> = {
  text: 'Text / Write-up',
  repo: 'GitHub Repository URL',
  url: 'Public URL',
  image: 'Image URL',
  document: 'Document URL or Text',
};

const KIND_PLACEHOLDER: Record<DeliverableKind, string> = {
  text: 'Paste the deliverable text here…',
  repo: 'https://github.com/owner/repo',
  url: 'https://your-deployed-site.com',
  image: 'https://example.com/screenshot.png',
  document: 'Paste document text or URL…',
};

export const SubmitDeliverableModal: React.FC<SubmitDeliverableModalProps> = ({
  milestoneId,
  milestoneName,
  projectId,
  deliverableType,
  onClose,
  onSubmitted,
}) => {
  const [kind, setKind] = useState<DeliverableKind>(deliverableType ?? 'text');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSteps, setReviewSteps] = useState<string[]>([]);
  const [reviewDone, setReviewDone] = useState(false);
  const [finalVerdict, setFinalVerdict] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [injectionWarning, setInjectionWarning] = useState(false);
  const stepListRef = useRef<HTMLUListElement>(null);

  // Scroll to bottom when new steps arrive
  useEffect(() => {
    if (stepListRef.current) {
      stepListRef.current.scrollTop = stepListRef.current.scrollHeight;
    }
  }, [reviewSteps]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter the deliverable content.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setReviewSteps([]);
    setReviewDone(false);
    setFinalVerdict(null);
    setFeedback(null);
    setInjectionWarning(false);

    const payload = ['url', 'repo', 'image'].includes(kind) ? { url: content.trim() } : { text: content.trim() };

    try {
      const res = await apiRawFetch(`/api/milestones/${milestoneId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Submission failed.');
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { deliverableId: string; status: string };
      onSubmitted?.(data.deliverableId);

      // Listen for SSE review.progress and review.completed events
      const evtSource = new EventSource(`/api/projects/${projectId}/sse`);

      evtSource.addEventListener('review.progress', (evt: MessageEvent) => {
        const parsed = JSON.parse(evt.data) as { description: string };
        setReviewSteps((prev) => [...prev, parsed.description]);
      });

      evtSource.addEventListener('review.completed', (evt: MessageEvent) => {
        const parsed = JSON.parse(evt.data) as {
          verdict: string;
          feedbackForFreelancer: string;
          injectionSuspected: boolean;
        };
        setFinalVerdict(parsed.verdict);
        setFeedback(parsed.feedbackForFreelancer);
        setInjectionWarning(parsed.injectionSuspected);
        setReviewDone(true);
        evtSource.close();
        setSubmitting(false);
      });

      evtSource.onerror = () => {
        evtSource.close();
        setSubmitting(false);
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      setSubmitting(false);
    }
  }

  function verdictColor(v: string): string {
    if (v === 'release') return '#22c55e';
    if (v === 'request_changes') return '#f59e0b';
    return '#6366f1';
  }

  function verdictLabel(v: string): string {
    if (v === 'release') return '✅ Approved for release';
    if (v === 'request_changes') return '🔁 Changes requested';
    return '👤 Escalated to client';
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 540,
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <h2 id="submit-modal-title" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
          Submit Deliverable
        </h2>
        <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14 }}>
          {milestoneName}
        </p>

        {!reviewDone ? (
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Deliverable type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DeliverableKind)}
              disabled={submitting || !!deliverableType}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6,
                border: '1px solid #d1d5db', marginBottom: 16, fontSize: 14,
              }}
            >
              {(Object.entries(KIND_LABELS) as [DeliverableKind, string][]).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>

            <label
              htmlFor="deliverable-content"
              style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}
            >
              {KIND_LABELS[kind]}
            </label>
            <textarea
              id="deliverable-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={KIND_PLACEHOLDER[kind]}
              disabled={submitting}
              rows={6}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />

            {error && (
              <p role="alert" style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
                {error}
              </p>
            )}

            {submitting && reviewSteps.length === 0 && (
              <p style={{ color: '#6366f1', fontSize: 13, marginTop: 10 }}>
                Submitting…
              </p>
            )}

            {reviewSteps.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  🤖 AI Review in progress…
                </p>
                <ul
                  ref={stepListRef}
                  aria-live="polite"
                  aria-label="Review steps"
                  style={{
                    listStyle: 'none', margin: 0, maxHeight: 160,
                    overflowY: 'auto', background: '#f9fafb', borderRadius: 6, padding: '8px 12px',
                    fontSize: 13, color: '#374151',
                  }}
                >
                  {reviewSteps.map((step, i) => (
                    <li key={i} style={{ padding: '3px 0' }}>→ {step}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#fff', cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: submitting ? '#a5b4fc' : '#6366f1',
                  color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Reviewing…' : 'Submit for Review'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* Review result */}
            <div
              aria-live="assertive"
              style={{
                background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16,
                borderLeft: `4px solid ${verdictColor(finalVerdict ?? '')}`,
              }}
            >
              <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 8px' }}>
                {verdictLabel(finalVerdict ?? '')}
              </p>
              {injectionWarning && (
                <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 8px' }}>
                  ⚠️ Potential prompt injection was detected in this deliverable.
                </p>
              )}
              {feedback && (
                <p style={{ fontSize: 13, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {feedback}
                </p>
              )}
            </div>

            {reviewSteps.length > 0 && (
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
                  View review steps ({reviewSteps.length})
                </summary>
                <ul style={{ listStyle: 'none', padding: '8px 0 0', margin: 0, fontSize: 12, color: '#6b7280' }}>
                  {reviewSteps.map((s, i) => <li key={i}>→ {s}</li>)}
                </ul>
              </details>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
