import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Select,
  StatusBadge,
  Badge,
  FinancialFigure,
  LifecycleProgress,
  Dialog,
  SlideOver,
  EmptyState,
  Skeleton,
  EvidenceChip,
  Timeline,
  ProjectRow,
  MilestoneRow,
  Tabs,
} from '../components/ui/index.js';
import { Avatar } from '../components/ui/Skeleton.js';
import { Plus, Sparkles, FolderKanban } from 'lucide-react';

export const StyleguidePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('components');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [demoLifecycleStatus, setDemoLifecycleStatus] = useState('in_review');

  const swatches = [
    { token: '--paper', hex: '#F5F2EA', name: 'Paper (App BG)', light: true },
    { token: '--surface', hex: '#FFFFFF', name: 'Surface (Cards/Panels)', light: true },
    { token: '--forest', hex: '#202722', name: 'Forest (Primary/Dark)', light: false },
    { token: '--ink', hex: '#252922', name: 'Ink (Primary Text)', light: false },
    { token: '--ink-2', hex: '#5F645C', name: 'Ink-2 (Secondary Text)', light: false },
    { token: '--line', hex: '#E6E3DA', name: 'Line (Hairline Border)', light: true },
    { token: '--teal', hex: '#337D70', name: 'Teal (Action Fill)', light: false },
    { token: '--teal-ink', hex: '#2B6B60', name: 'Teal Ink (Text on Paper)', light: false },
    { token: '--teal-wash', hex: '#E3EFEC', name: 'Teal Wash (Background Tint)', light: true },
    { token: '--amber', hex: '#D7A65A', name: 'Amber (Fill/Border/Icon)', light: true },
    { token: '--amber-ink', hex: '#8A5A0B', name: 'Amber Ink (Text on Paper)', light: false },
    { token: '--amber-wash', hex: '#F6EBD6', name: 'Amber Wash (Tint)', light: true },
    { token: '--red', hex: '#B3392B', name: 'Red (Error/Failures)', light: false },
    { token: '--red-wash', hex: '#F7E3DF', name: 'Red Wash (Tint)', light: true },
    { token: '--focus', hex: '#2F5FD0', name: 'Focus (Keyboard Ring)', light: false },
  ];

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--teal-ink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Design System & Component Library
        </span>
        <h1 className="font-display" style={{ fontSize: '2.5rem', color: 'var(--ink)', margin: '0.5rem 0' }}>
          Editorial Fintech & Precision SaaS
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--ink-2)', maxWidth: '680px', lineHeight: 1.5, margin: 0 }}>
          Specification per <code style={{ backgroundColor: 'var(--surface)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--line)' }}>docs/UI_IMPLEMENTATION.md</code>.
          Zero external font requests; accessible contrast; sentence case everywhere.
        </p>
      </div>

      <Tabs
        tabs={[
          { id: 'components', label: 'Components & Primitives' },
          { id: 'tokens', label: 'Color & Typography Tokens' },
          { id: 'lifecycle', label: 'Lifecycle & Money States' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Components & Primitives */}
      {activeTab === 'components' && (
        <div
          role="tabpanel"
          id="panel-components"
          aria-labelledby="tab-components"
          style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}
        >
          {/* Section: Badges, Avatars & Skeletons */}
          <section aria-labelledby="avatars-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="avatars-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Badges, Avatars & Skeletons
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <Avatar name="Sarah Lin" roleBadge="client" size="md" />
              <Avatar name="Arjun Mehta" roleBadge="freelancer" size="md" />
              <Badge variant="neutral">Neutral tag</Badge>
              <Badge variant="teal">Verified criteria</Badge>
              <Badge variant="amber">Pending review</Badge>
              <Badge variant="red">Flagged issue</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Loading skeletons:</span>
              <Skeleton width="100%" height="1.25rem" />
              <Skeleton width="60%" height="1rem" />
            </div>
          </section>

          {/* Section: Buttons */}
          <section aria-labelledby="buttons-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="buttons-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Buttons & Triggers
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Button variant="primary">Primary forest</Button>
              <Button variant="secondary">Secondary outline</Button>
              <Button variant="quiet">Quiet text</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="primary" isLoading>
                Processing
              </Button>
              <Button variant="secondary" leftIcon={<Plus size={16} />}>
                With Icon
              </Button>
              <IconButton icon={<Sparkles size={16} />} label="Magic action" variant="secondary" />
            </div>
          </section>

          {/* Section: Form Fields */}
          <section aria-labelledby="form-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="form-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Form Controls & Validation
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <Field label="Project title" hint="A clear name for this agreement" required>
                {(props) => <Input placeholder="e.g. Mobile Design Sprint" {...props} />}
              </Field>

              <Field label="PayPal sandbox email" error="Enter a valid sandbox email address">
                {(props) => <Input isError placeholder="freelancer-sandbox@domain.com" {...props} />}
              </Field>

              <Field label="Deliverable type">
                {(props) => (
                  <Select {...props}>
                    <option value="url">URL Preview / Staging</option>
                    <option value="repo">Git Repository</option>
                    <option value="document">Document / PDF</option>
                    <option value="image">Design Image / Asset</option>
                    <option value="figma">Figma Workspace</option>
                  </Select>
                )}
              </Field>

              <Field label="Acceptance criteria" hint="What does passing work look like?">
                {(props) => <Textarea rows={3} placeholder="1. All 12 unit tests pass on clean clone..." {...props} />}
              </Field>
            </div>
          </section>

          {/* Section: Modals & Slide-overs */}
          <section aria-labelledby="modals-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="modals-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Overlays (Dialog & Slide-over)
            </h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
                Open Modal Dialog
              </Button>
              <Button variant="secondary" onClick={() => setIsSlideOverOpen(true)}>
                Open Deliverable Slide-over
              </Button>
            </div>

            <Dialog
              isOpen={isDialogOpen}
              onClose={() => setIsDialogOpen(false)}
              title="Fund project agreement"
              description="Funds are held for this project and released milestone by milestone."
              footer={
                <>
                  <Button variant="quiet" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => setIsDialogOpen(false)}>
                    Confirm and fund
                  </Button>
                </>
              }
            >
              <p style={{ margin: 0, color: 'var(--ink)' }}>
                This dialog demonstrates focus trapping, Escape key closing, and accessible keyboard navigation per WCAG 2.2 guidelines.
              </p>
            </Dialog>

            <SlideOver
              isOpen={isSlideOverOpen}
              onClose={() => setIsSlideOverOpen(false)}
              title="Submit deliverable"
              description="Milestone 2: Wireframes & Architecture Approved"
              footer={
                <Button variant="primary" style={{ width: '100%' }} onClick={() => setIsSlideOverOpen(false)}>
                  Submit for AI verification
                </Button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Field label="Deliverable link or repository">
                  {(props) => <Input placeholder="https://github.com/..." {...props} />}
                </Field>
                <Field label="Notes for the reviewer">
                  {(props) => <Textarea rows={4} placeholder="Summary of changes..." {...props} />}
                </Field>
              </div>
            </SlideOver>
          </section>

          {/* Section: Project Rows & Empty States */}
          <section aria-labelledby="rows-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="rows-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Domain Rows & Empty States
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ProjectRow
                id="proj_1"
                title="Brand-site Redesign & Launch"
                stateSentence="Milestone 3 passed review. Ready to release."
                heldCents={420000}
                paidCents={180000}
                totalCents={600000}
                nextActionLabel="Release payment"
                onNextAction={() => alert('Release payment clicked')}
                isDemo
              />

              <MilestoneRow
                id="ms_1"
                name="Milestone 2: Interactive Wireframes"
                amountCents={180000}
                status="funded"
                backendStatus="funded"
                dueDate="Nov 14, 2026"
                criteriaCount={4}
                actionLabel="Review"
                onAction={() => alert('Review clicked')}
              />
            </div>

            <EmptyState
              icon={<FolderKanban size={32} />}
              title="No projects yet"
              description="Start by drafting a project brief to generate a structured timeline."
              actionLabel="Create a project"
              onAction={() => alert('Create project clicked')}
            />
          </section>

          {/* Section: Evidence Chips & Timeline */}
          <section aria-labelledby="timeline-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 id="timeline-heading" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
              Evidence Chips & Event Timeline
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <EvidenceChip type="url" label="Live Staging Preview" url="https://verify-pay.onrender.com" />
              <EvidenceChip type="repo" label="GitHub Commits" url="https://github.com/amoghV17-arch/verify_pay" />
              <EvidenceChip type="document" label="API Spec.pdf" />
              <EvidenceChip type="figma" label="Figma Component File" />
            </div>

            <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius-card)', border: '1px solid var(--line)' }}>
              <Timeline
                events={[
                  {
                    id: '1',
                    actor: 'client',
                    title: 'Project agreement created and funded',
                    description: '$8,000.00 held for this project in PayPal Sandbox',
                    timestamp: new Date().toISOString(),
                  },
                  {
                    id: '2',
                    actor: 'freelancer',
                    title: 'Deliverable submitted for Milestone 1',
                    description: 'GitHub repository PR #12 with 4 passing tests',
                    timestamp: new Date().toISOString(),
                  },
                  {
                    id: '3',
                    actor: 'ai',
                    title: 'AI Reviewer verified deliverable',
                    description: 'All 4 acceptance criteria passed (confidence: 94%)',
                    timestamp: new Date().toISOString(),
                  },
                ]}
              />
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Tokens */}
      {activeTab === 'tokens' && (
        <div
          role="tabpanel"
          id="panel-tokens"
          aria-labelledby="tab-tokens"
          style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
        >
          <section aria-labelledby="color-heading">
            <h2 id="color-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Color Token Palette (Section 3.1)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {swatches.map((s) => (
                <div
                  key={s.token}
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      height: '60px',
                      backgroundColor: s.hex,
                      borderBottom: '1px solid var(--line)',
                    }}
                  />
                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <code style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)' }}>{s.token}</code>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)' }}>{s.hex}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink)', marginTop: '0.2rem' }}>{s.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="type-heading">
            <h2 id="type-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Typography Hierarchy (Section 3.2)
            </h2>
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Editorial Display (DM Serif Display)</span>
                <h1 className="font-display" style={{ fontSize: '2.5rem', margin: '0.25rem 0' }}>
                  Good work deserves a <em>clear agreement</em>.
                </h1>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>UI Font (Geist Sans Regular / Semibold)</span>
                <p style={{ margin: '0.25rem 0', fontSize: '1rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                  Milestone holds a project's budget, checks each delivery against criteria both sides agreed to, and releases payment when it passes.
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Financial Numerals (Tabular Nums)</span>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                  <FinancialFigure label="Held for this project" amountCents={800000} size="lg" trend="held" />
                  <FinancialFigure label="Released to freelancer" amountCents={320000} size="lg" trend="paid" />
                  <FinancialFigure label="Total budget" amountCents={800000} size="lg" trend="neutral" />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Lifecycle & Statuses */}
      {activeTab === 'lifecycle' && (
        <div
          role="tabpanel"
          id="panel-lifecycle"
          aria-labelledby="tab-lifecycle"
          style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
        >
          <section aria-labelledby="status-heading">
            <h2 id="status-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Money States (Section 3.1: Glyph + Word, Never Color Alone)
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <StatusBadge state="agreed" />
              <StatusBadge state="funded" />
              <StatusBadge state="in_review" />
              <StatusBadge state="needs_decision" />
              <StatusBadge state="changes_requested" />
              <StatusBadge state="releasing" />
              <StatusBadge state="paid" />
            </div>
          </section>

          <section aria-labelledby="interactive-lifecycle-heading">
            <h2 id="interactive-lifecycle-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Signature LifecycleProgress Component (Section 8.1)
            </h2>
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['draft', 'funded', 'in_review', 'changes_requested', 'approved', 'releasing', 'paid'].map((st) => (
                  <Button
                    key={st}
                    variant={demoLifecycleStatus === st ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setDemoLifecycleStatus(st)}
                  >
                    {st}
                  </Button>
                ))}
              </div>

              <LifecycleProgress backendStatus={demoLifecycleStatus} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>Compact row variant:</span>
                <LifecycleProgress backendStatus={demoLifecycleStatus} variant="compact" />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
