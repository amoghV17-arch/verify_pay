import React, { useState } from 'react';
import type { ComputedPlan } from '@milestone/shared';

interface StartScreenProps {
  onPlanGenerated: (plan: ComputedPlan) => void;
  onCancel?: () => void;
}

const SAMPLE_BRIEF =
  'Redesign our brand website, interactive pricing calculator, and high-converting signup funnel with responsive Figma layouts and cross-browser testing.';

export const StartScreen: React.FC<StartScreenProps> = ({ onPlanGenerated, onCancel }) => {
  const [brief, setBrief] = useState('');
  const [totalBudget, setTotalBudget] = useState(2500);
  const [durationHint, setDurationHint] = useState('3-4 weeks');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFillSample = () => {
    setBrief(SAMPLE_BRIEF);
    setTotalBudget(2500);
    setDurationHint('4 weeks');
    setErrorMessage(null);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim()) {
      setErrorMessage('Please describe the project scope or click "Fill with sample brief".');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setElapsedSec(0);

    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    try {
      const res = await fetch('/api/projects/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brief: brief.trim(),
          totalBudget,
          durationHint,
          currency: 'USD',
        }),
      });

      clearInterval(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `Plan generation failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.plan) {
        throw new Error(data.error || 'The AI planner was unable to generate a valid plan for this brief.');
      }

      onPlanGenerated(data.plan);
    } catch (err) {
      clearInterval(timer);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '860px',
        margin: '40px auto',
        padding: '32px',
        backgroundColor: 'var(--paper, #ffffff)',
        borderRadius: '8px',
        border: '1px solid var(--line, #dde3e9)',
        boxShadow: '0 4px 12px rgba(22, 32, 43, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: 'var(--ink, #16202b)',
              marginBottom: '8px',
            }}
          >
            Create a Verified Project Plan
          </h1>
          <p style={{ color: 'var(--slate, #5b6b7c)', fontSize: '15px', lineHeight: 1.5 }}>
            Describe the work in your own words. The plan comes back with milestones you can edit.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--slate, #5b6b7c)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '6px 12px',
            }}
          >
            Back to Workspace
          </button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            backgroundColor: '#fdf2f2',
            border: '1px solid var(--flag, #c8402f)',
            borderRadius: '4px',
            color: 'var(--flag, #c8402f)',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      <form onSubmit={handleCreatePlan}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label
              htmlFor="brief-input"
              style={{ fontWeight: 500, fontSize: '14px', color: 'var(--ink, #16202b)' }}
            >
              Project Brief (Requirements, scope, and target outcomes)
            </label>
            <button
              id="sample-brief-btn"
              type="button"
              onClick={handleFillSample}
              style={{
                background: 'transparent',
                border: '1px dashed var(--slate, #5b6b7c)',
                color: 'var(--slate, #5b6b7c)',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Fill with sample brief
            </button>
          </div>
          <textarea
            id="brief-input"
            rows={6}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. Build an executive customer churn prediction model and an interactive cohort dashboard with full test coverage..."
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '15px',
              lineHeight: 1.5,
              borderRadius: '4px',
              border: '1px solid var(--line, #dde3e9)',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
          <div>
            <label
              htmlFor="budget-input"
              style={{ display: 'block', fontWeight: 500, fontSize: '14px', marginBottom: '8px', color: 'var(--ink, #16202b)' }}
            >
              Total Budget ($ USD)
            </label>
            <input
              id="budget-input"
              type="number"
              min={100}
              max={100000}
              step={50}
              value={totalBudget}
              onChange={(e) => setTotalBudget(Number(e.target.value))}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                borderRadius: '4px',
                border: '1px solid var(--line, #dde3e9)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="duration-input"
              style={{ display: 'block', fontWeight: 500, fontSize: '14px', marginBottom: '8px', color: 'var(--ink, #16202b)' }}
            >
              Target Duration (Optional)
            </label>
            <input
              id="duration-input"
              type="text"
              value={durationHint}
              onChange={(e) => setDurationHint(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. 4 weeks"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                borderRadius: '4px',
                border: '1px solid var(--line, #dde3e9)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--slate, #5b6b7c)' }}>
            AI analyzes effort, milestones, dependencies, and verifiable criteria.
          </span>

          <button
            id="create-plan-btn"
            type="submit"
            disabled={isLoading || !brief.trim()}
            style={{
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: isLoading ? 'var(--slate, #5b6b7c)' : 'var(--tide, #1f7a8c)',
              color: '#ffffff',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Generating plan ({elapsedSec}s)...</span>
              </>
            ) : (
              'Create plan'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
