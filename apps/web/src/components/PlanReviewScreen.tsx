import React, { useState, useMemo } from 'react';
import type { ComputedPlan, ScheduledMilestone, DeliverableType } from '@milestone/shared';
import { formatCents, distributePercentages } from '@milestone/shared';
import { MilestoneGantt } from './Gantt.js';

interface PlanReviewScreenProps {
  initialPlan: ComputedPlan;
  projectId: string;
  onPlanApproved: (appliedData: unknown) => void;
  onBack: () => void;
}

export function planToGanttData(plan: ComputedPlan) {
  const tasksData = [
    ...plan.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      duration: t.durationDays,
      durationUnit: 'd',
      percentDone: 0,
      milestone: false,
      milestoneId: t.milestoneId,
      cls: 'task-standard',
    })),
    ...plan.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      startDate: m.date,
      duration: 0,
      durationUnit: 'd',
      milestone: true,
      amountCents: m.amountCents,
      paymentStatus: 'unfunded',
      acceptanceCriteria: m.acceptanceCriteria,
      deliverableType: m.deliverableType,
      cls: 'milestone-status-unfunded',
    })),
  ];

  const dependenciesData: Array<{ id: string; from: string; to: string; type: number }> = [];
  // Task dependencies
  for (const t of plan.tasks) {
    for (const depId of t.dependsOn) {
      dependenciesData.push({
        id: `dep_${t.id}_${depId}`,
        from: depId,
        to: t.id,
        type: 2,
      });
    }
  }
  // Milestone dependencies
  for (const m of plan.milestones) {
    for (const prevId of m.afterTaskIds) {
      dependenciesData.push({
        id: `dep_${m.id}_${prevId}`,
        from: prevId,
        to: m.id,
        type: 2,
      });
    }
  }

  return { tasksData, dependenciesData };
}

export const PlanReviewScreen: React.FC<PlanReviewScreenProps> = ({
  initialPlan,
  projectId,
  onPlanApproved,
  onBack,
}) => {
  const [projectTitle, setProjectTitle] = useState(initialPlan.projectTitle);
  const [summary, setSummary] = useState(initialPlan.summary);
  const [assumptions, setAssumptions] = useState<string[]>(initialPlan.assumptions);
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [milestones, setMilestones] = useState<ScheduledMilestone[]>(initialPlan.milestones);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live sum of percentages
  const totalPercent = useMemo(() => {
    return milestones.reduce((sum, m) => sum + (Number(m.paymentPercent) || 0), 0);
  }, [milestones]);

  const isPercentageValid = totalPercent === 100;

  // Recompute amounts based on percentages
  const computedMilestones = useMemo(() => {
    const totalCents = Math.round(initialPlan.totalBudget * 100);
    const percentages = milestones.map((m) => Number(m.paymentPercent) || 0);
    let amounts: number[] = [];
    try {
      if (isPercentageValid) {
        amounts = distributePercentages(totalCents, percentages);
      } else {
        amounts = percentages.map((p) => Math.round((totalCents * p) / 100));
      }
    } catch {
      amounts = percentages.map((p) => Math.round((totalCents * p) / 100));
    }

    return milestones.map((m, idx) => ({
      ...m,
      amountCents: amounts[idx] ?? 0,
    }));
  }, [milestones, initialPlan.totalBudget, isPercentageValid]);

  // Updated plan for Gantt preview
  const currentPlan: ComputedPlan = useMemo(() => {
    return {
      ...initialPlan,
      projectTitle,
      summary,
      assumptions,
      milestones: computedMilestones,
    };
  }, [initialPlan, projectTitle, summary, assumptions, computedMilestones]);

  const { tasksData, dependenciesData } = useMemo(() => {
    return planToGanttData(currentPlan);
  }, [currentPlan]);

  const handleMilestoneNameChange = (idx: number, newName: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], name: newName };
      return copy;
    });
  };

  const handleMilestonePercentChange = (idx: number, val: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], paymentPercent: val };
      return copy;
    });
  };

  const handleDeliverableTypeChange = (idx: number, type: DeliverableType) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], deliverableType: type };
      return copy;
    });
  };

  const handleCriterionChange = (mIdx: number, cIdx: number, text: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const criteriaCopy = [...copy[mIdx].acceptanceCriteria];
      criteriaCopy[cIdx] = text;
      copy[mIdx] = { ...copy[mIdx], acceptanceCriteria: criteriaCopy };
      return copy;
    });
  };

  const handleAddCriterion = (mIdx: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      if (copy[mIdx].acceptanceCriteria.length >= 5) return prev;
      copy[mIdx] = {
        ...copy[mIdx],
        acceptanceCriteria: [...copy[mIdx].acceptanceCriteria, 'Deliverable verified with test suite or URL preview'],
      };
      return copy;
    });
  };

  const handleDeleteCriterion = (mIdx: number, cIdx: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      if (copy[mIdx].acceptanceCriteria.length <= 2) return prev; // min 2
      const criteriaCopy = copy[mIdx].acceptanceCriteria.filter((_, i) => i !== cIdx);
      copy[mIdx] = { ...copy[mIdx], acceptanceCriteria: criteriaCopy };
      return copy;
    });
  };

  const handleAssumptionChange = (idx: number, text: string) => {
    setAssumptions((prev) => {
      const copy = [...prev];
      copy[idx] = text;
      return copy;
    });
  };

  const handleDeleteAssumption = (idx: number) => {
    setAssumptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddAssumption = () => {
    if (assumptions.length >= 6) return;
    setAssumptions((prev) => [...prev, 'New assumption regarding scope or dependencies']);
  };

  const handleApprovePlan = async () => {
    if (!isPercentageValid) {
      setErrorMessage('Milestone percentages must sum to exactly 100% before approving.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/plan/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: currentPlan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Failed to apply plan (${res.status})`);
      }

      const data = await res.json();
      onPlanApproved(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--chalk, #f5f7f9)' }}>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          backgroundColor: 'var(--paper, #ffffff)',
          borderBottom: '1px solid var(--line, #dde3e9)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            id="back-brief-btn"
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: '1px solid var(--line, #dde3e9)',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--slate, #5b6b7c)',
            }}
          >
            ← Edit Brief
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="plan-title-input"
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--ink, #16202b)',
                  border: '1px solid transparent',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--line, #dde3e9)')}
                onBlur={(e) => (e.target.style.borderColor = 'transparent')}
              />
              <span
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(31, 122, 140, 0.1)',
                  color: 'var(--tide, #1f7a8c)',
                  fontWeight: 600,
                }}
              >
                AI Planned
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--slate, #5b6b7c)', marginTop: '2px' }}>
              Total Budget: {formatCents(Math.round(initialPlan.totalBudget * 100))} • {currentPlan.tasks.length} tasks • {milestones.length} milestones
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Percentage Live Indicator */}
          <div
            id="percentage-meter-badge"
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isPercentageValid ? '#eafaf1' : '#fdf2f2',
              color: isPercentageValid ? 'var(--settled, #1d8f5a)' : 'var(--flag, #c8402f)',
              border: `1px solid ${isPercentageValid ? '#b7ebd0' : '#f8b4ad'}`,
            }}
          >
            <span>{isPercentageValid ? '✓' : '⚠'}</span>
            <span>{totalPercent}% Total</span>
            {!isPercentageValid && <span style={{ fontWeight: 400 }}>(Must equal 100%)</span>}
          </div>

          <button
            id="approve-plan-btn"
            type="button"
            onClick={handleApprovePlan}
            disabled={!isPercentageValid || isSaving}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: !isPercentageValid || isSaving ? 'var(--slate, #5b6b7c)' : 'var(--settled, #1d8f5a)',
              color: '#ffffff',
              border: 'none',
              cursor: !isPercentageValid || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSaving ? 'Saving plan...' : 'Approve plan'}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '10px 24px',
            backgroundColor: '#fdf2f2',
            color: 'var(--flag, #c8402f)',
            fontSize: '13px',
            borderBottom: '1px solid #f8b4ad',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Main Body: Side form (380px) + Bryntum Gantt Timeline */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side Form */}
        <aside
          style={{
            width: '420px',
            borderRight: '1px solid var(--line, #dde3e9)',
            backgroundColor: 'var(--paper, #ffffff)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Summary */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, #dde3e9)' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--slate, #5b6b7c)', display: 'block', marginBottom: '6px' }}>
              Project Scope Summary
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid var(--line, #dde3e9)',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Collapsible Assumptions List */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line, #dde3e9)', backgroundColor: '#fafbfc' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowAssumptions(!showAssumptions)}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink, #16202b)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{showAssumptions ? '▾' : '▸'}</span>
                <span>AI Assumptions ({assumptions.length})</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddAssumption();
                }}
                disabled={assumptions.length >= 6}
                style={{
                  fontSize: '11px',
                  background: 'none',
                  border: '1px solid var(--line, #dde3e9)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  color: 'var(--slate, #5b6b7c)',
                }}
              >
                + Add
              </button>
            </div>

            {showAssumptions && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assumptions.map((item, aIdx) => (
                  <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleAssumptionChange(aIdx, e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        border: '1px solid var(--line, #dde3e9)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteAssumption(aIdx)}
                      title="Remove assumption"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--flag, #c8402f)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '0 4px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestones & Criteria Form */}
          <div style={{ padding: '16px 20px', flex: 1 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink, #16202b)', marginBottom: '14px' }}>
              Milestones & Acceptance Criteria
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {computedMilestones.map((m, mIdx) => (
                <div
                  key={m.id}
                  style={{
                    padding: '14px',
                    borderRadius: '6px',
                    border: '1px solid var(--line, #dde3e9)',
                    backgroundColor: 'var(--paper, #ffffff)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tide, #1f7a8c)' }}>
                      MILESTONE {mIdx + 1} ({m.id})
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--settled, #1d8f5a)' }}>
                      {formatCents(m.amountCents)}
                    </span>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => handleMilestoneNameChange(mIdx, e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--line, #dde3e9)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--slate, #5b6b7c)', display: 'block', marginBottom: '4px' }}>
                        Payment Share
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min={5}
                          max={40}
                          value={m.paymentPercent}
                          onChange={(e) => handleMilestonePercentChange(mIdx, Number(e.target.value))}
                          style={{
                            width: '60px',
                            padding: '4px 6px',
                            fontSize: '13px',
                            borderRadius: '4px',
                            border: '1px solid var(--line, #dde3e9)',
                          }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--slate, #5b6b7c)' }}>%</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--slate, #5b6b7c)', display: 'block', marginBottom: '4px' }}>
                        Deliverable Type
                      </label>
                      <select
                        value={m.deliverableType}
                        onChange={(e) => handleDeliverableTypeChange(mIdx, e.target.value as DeliverableType)}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          border: '1px solid var(--line, #dde3e9)',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <option value="url">URL Preview</option>
                        <option value="repo">Git Repository</option>
                        <option value="document">Document / PDF</option>
                        <option value="image">Design Image / Asset</option>
                        <option value="text">Written Summary / Text</option>
                      </select>
                    </div>
                  </div>

                  {/* Acceptance Criteria List */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate, #5b6b7c)' }}>
                        ACCEPTANCE CRITERIA ({m.acceptanceCriteria.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddCriterion(mIdx)}
                        disabled={m.acceptanceCriteria.length >= 5}
                        style={{
                          fontSize: '11px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--tide, #1f7a8c)',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        + Add Check
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {m.acceptanceCriteria.map((crit, cIdx) => (
                        <div key={cIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--slate, #5b6b7c)', marginTop: '4px' }}>•</span>
                          <textarea
                            rows={2}
                            value={crit}
                            onChange={(e) => handleCriterionChange(mIdx, cIdx, e.target.value)}
                            style={{
                              flex: 1,
                              fontSize: '12px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--line, #dde3e9)',
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                              resize: 'none',
                            }}
                          />
                          {m.acceptanceCriteria.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCriterion(mIdx, cIdx)}
                              title="Delete criterion"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--flag, #c8402f)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '2px',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Interactive Bryntum Gantt Timeline */}
        <main style={{ flex: 1, height: '100%', position: 'relative' }}>
          <MilestoneGantt
            projectId={projectId}
            tasksData={tasksData}
            dependenciesData={dependenciesData}
            readOnly={false}
          />
        </main>
      </div>
    </div>
  );
};
