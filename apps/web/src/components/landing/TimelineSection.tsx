import React, { useState, useEffect, useRef } from 'react';
import { FinancialFigure } from '../ui/FinancialFigure.js';
import { Calendar, CheckCircle } from 'lucide-react';

interface MilestoneItem {
  id: string;
  name: string;
  duration: string;
  amountCents: number;
  criteriaCount: number;
}

const MILESTONES: MilestoneItem[] = [
  {
    id: 'm1',
    name: 'Brand Strategy & Voice',
    duration: '2 weeks',
    amountCents: 120000,
    criteriaCount: 2,
  },
  {
    id: 'm2',
    name: 'Wireframes & System',
    duration: '3 weeks',
    amountCents: 180000,
    criteriaCount: 3,
  },
  {
    id: 'm3',
    name: 'Interactive Prototype',
    duration: '3 weeks',
    amountCents: 240000,
    criteriaCount: 3,
  },
  {
    id: 'm4',
    name: 'Production Launch',
    duration: '2 weeks',
    amountCents: 260000,
    criteriaCount: 4,
  },
];

export const TimelineSection: React.FC = () => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      style={{
        padding: '5rem 1.5rem',
        backgroundColor: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Section Header */}
        <div
          style={{
            maxWidth: '680px',
            marginBottom: '3.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--teal-ink)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.5rem',
            }}
          >
            Structured clarity
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
              lineHeight: 1.15,
              color: 'var(--ink)',
              margin: '0 0 1rem 0',
            }}
          >
            One agreement, every milestone.
          </h2>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            The agreed plan is the shared reference for both people. Deliverable definitions,
            acceptance criteria, and budget allocations are locked before any work starts or money is funded.
          </p>
        </div>

        {/* Desktop / Tablet Timeline Strip */}
        <div
          style={{
            position: 'relative',
            marginTop: '2rem',
          }}
        >
          {/* Animated SVG connecting line (visible desktop/tablet) */}
          <div
            aria-hidden="true"
            style={{
              position: 'relative',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <svg
              style={{
                width: '100%',
                height: '100%',
                overflow: 'visible',
              }}
            >
              {/* Background hairline */}
              <line
                x1="4%"
                y1="16"
                x2="96%"
                y2="16"
                stroke="var(--line-strong)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              {/* Animated drawn line */}
              <line
                x1="4%"
                y1="16"
                x2="96%"
                y2="16"
                stroke="var(--teal)"
                strokeWidth="2.5"
                style={{
                  strokeDasharray: '1000',
                  strokeDashoffset: hasAnimated ? '0' : '1000',
                  transition: 'stroke-dashoffset 1.4s var(--ease-out)',
                }}
              />
            </svg>
          </div>

          {/* Milestone Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {MILESTONES.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  opacity: 1,
                  transform: hasAnimated ? 'translateY(0)' : 'translateY(8px)',
                  transition: `all 500ms var(--ease-out) ${idx * 120}ms`,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Milestone diamond & step index */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        transform: 'rotate(45deg)',
                        backgroundColor: hasAnimated ? 'var(--teal)' : 'var(--line-strong)',
                        transition: `background-color 400ms ease ${idx * 150}ms`,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--ink-2)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Milestone {idx + 1}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <Calendar size={13} aria-hidden="true" />
                    {m.duration}
                  </span>
                </div>

                {/* Milestone Name */}
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {m.name}
                </h3>

                {/* Criteria Count and Financial Figure */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <CheckCircle size={13} style={{ color: 'var(--teal)' }} aria-hidden="true" />
                    {m.criteriaCount} criteria
                  </span>

                  <FinancialFigure
                    amountCents={m.amountCents}
                    size="sm"
                    label="Agreed payout"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Project Total Summary Footnote */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1.5rem',
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              fontSize: '0.875rem',
              color: 'var(--ink-2)',
            }}
          >
            <span>
              Total agreement budget: <strong>4 milestones</strong> across <strong>10 weeks</strong>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total sandbox allocation:
              </span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', color: 'var(--ink)' }}>
                $8,000.00
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
