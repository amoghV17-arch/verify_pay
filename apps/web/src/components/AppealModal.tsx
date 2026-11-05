/**
 * AppealModal — lets a freelancer appeal an AI reviewer verdict.
 * Follows M7 checklist: second independent review (appeal.v1.md)
 * with real-time SSE progress streaming.
 */
import React, { useState, useEffect, useRef } from 'react';

interface AppealModalProps {
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  milestoneId,
  milestoneName,
  projectId,
  onClose,
  onSubmitted,
}) => {
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSteps, setReviewSteps] = useState<string[]>([]);
  const [reviewDone, setReviewDone] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const stepListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (stepListRef.current) {
      stepListRef.current.scrollTop = stepListRef.current.scrollHeight;
    }
  }, [reviewSteps]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (explanation.trim().length < 10) {
      setError('Appeal explanation must be at least 10 characters.');
      return;
    }

    setError(null);
    setSubmitting(true);
    setReviewSteps([]);
    setReviewDone(false);
    setVerdict(null);
    setFeedback(null);

    try {
      const res = await fetch(`/api/milestones/${milestoneId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation: explanation.trim() }),
        credentials: 'include',
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setError(body.error || body.message || 'Appeal submission failed.');
        setSubmitting(false);
        return;
      }

      onSubmitted?.();

      // Listen for SSE events
      const evtSource = new EventSource(`/api/projects/${projectId}/events`);

      evtSource.addEventListener('review.progress', (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data) as { description: string };
          setReviewSteps((prev) => [...prev, parsed.description]);
        } catch {
          // ignore
        }
      });

      evtSource.addEventListener('review.completed', (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data) as {
            verdict: string;
            feedbackForFreelancer?: string;
          };
          setVerdict(parsed.verdict);
          setFeedback(parsed.feedbackForFreelancer ?? null);
          setReviewDone(true);
          setSubmitting(false);
          evtSource.close();
        } catch {
          // ignore
        }
      });

      evtSource.addEventListener('milestone.status', (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data) as { status: string };
          if (parsed.status === 'approved' || parsed.status === 'awaiting_client') {
            setReviewDone(true);
            setSubmitting(false);
          }
        } catch {
          // ignore
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Appeal submission failed.';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22, 32, 43, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 id="appeal-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>
              Appeal Review Verdict
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--slate)' }}>
              {milestoneName} — Independent Second Review
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--slate)',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: '#1e40af',
          }}
        >
          <strong>Independent Second Review:</strong> A separate AI reviewer prompt evaluates your deliverable, the previous rejection feedback, and your explanation below.
        </div>

        {!reviewDone ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="appeal-explanation"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.25rem' }}
              >
                Why does this deliverable meet the criteria?
              </label>
              <textarea
                id="appeal-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain which criteria were satisfied and where the evidence can be verified (min 10 chars)..."
                rows={4}
                required
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                {explanation.length} / 10 characters minimum
              </span>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Live review progress steps */}
            {reviewSteps.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--slate)' }}>
                  Appeal Review Progress:
                </span>
                <ul
                  ref={stepListRef}
                  aria-live="polite"
                  style={{
                    listStyle: 'none',
                    padding: '0.5rem',
                    margin: '0.25rem 0 0',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    backgroundColor: '#f8fafc',
                    borderRadius: '4px',
                    border: '1px solid var(--line)',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {reviewSteps.map((s, i) => (
                    <li key={i} style={{ color: 'var(--ink)', padding: '0.15rem 0' }}>
                      ▶ {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                id="submit-appeal-btn"
                type="submit"
                disabled={submitting || explanation.trim().length < 10}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--tide)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: submitting || explanation.trim().length < 10 ? 'not-allowed' : 'pointer',
                  opacity: submitting || explanation.trim().length < 10 ? 0.6 : 1,
                }}
              >
                {submitting ? 'Submitting Appeal…' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              style={{
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                backgroundColor: verdict === 'release' ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${verdict === 'release' ? '#bbf7d0' : '#fde68a'}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1rem', color: verdict === 'release' ? '#16a34a' : '#d97706' }}>
                {verdict === 'release' ? '✓ Appeal Upheld (Approved)' : 'Escalated to Client for Resolution'}
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--ink)' }}>
                {feedback || (verdict === 'release' ? 'The deliverable meets criteria. Payment scheduled.' : 'Second reviewer did not overturn the verdict. Escalated to client.')}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--ink)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
