export interface SampleTaskData {
  id: string;
  name: string;
  startDate: string;
  duration: number;
  durationUnit?: string;
  percentDone?: number;
  milestone?: boolean;
  milestoneId?: string;
  amountCents?: number;
  paymentStatus?: 'unfunded' | 'funded' | 'submitted' | 'in_review' | 'changes_requested' | 'awaiting_client' | 'approved' | 'releasing' | 'paid' | 'appealed';
  acceptanceCriteria?: Array<{ id: string; description: string; passed?: boolean; evidence?: string }>;
  deliverableType?: string;
  cls?: string;
}

export interface SampleDependencyData {
  id: string;
  from: string;
  to: string;
}

export const sampleTasks: SampleTaskData[] = [
  // --- Milestone 1: Brand Strategy & Discovery ---
  {
    id: 't1',
    name: 'Stakeholder & customer interviews',
    startDate: '2026-11-09',
    duration: 3,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 't2',
    name: 'Competitive landscape & positioning audit',
    startDate: '2026-11-12',
    duration: 3,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 't3',
    name: 'Brand narrative & value prop synthesis',
    startDate: '2026-11-15',
    duration: 2,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 'm1',
    name: 'Milestone 1: Brand Strategy Approved',
    startDate: '2026-11-17',
    duration: 0,
    milestone: true,
    milestoneId: 'ms-01',
    amountCents: 120000,
    paymentStatus: 'paid',
    deliverableType: 'document',
    acceptanceCriteria: [
      { id: 'c1-1', description: 'At least 5 customer interview summaries documented', passed: true, evidence: 'Interviews synthesized in repo docs/research.md' },
      { id: 'c1-2', description: 'Positioning matrix compares 4 primary competitors', passed: true, evidence: 'Matrix verified with pricing & feature breakdown' },
    ],
  },

  // --- Milestone 2: Visual System & Wireframes ---
  {
    id: 't4',
    name: 'Information architecture & sitemap',
    startDate: '2026-11-17',
    duration: 2,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 't5',
    name: 'Core user flow wireframes',
    startDate: '2026-11-19',
    duration: 4,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 't6',
    name: 'Design system foundations & tokens',
    startDate: '2026-11-23',
    duration: 3,
    durationUnit: 'd',
    percentDone: 100,
  },
  {
    id: 'm2',
    name: 'Milestone 2: Wireframes & Architecture Approved',
    startDate: '2026-11-26',
    duration: 0,
    milestone: true,
    milestoneId: 'ms-02',
    amountCents: 180000,
    paymentStatus: 'approved',
    deliverableType: 'figma',
    acceptanceCriteria: [
      { id: 'c2-1', description: 'Wireframes cover landing, checkout, and account settings', passed: true, evidence: 'All 3 flows mapped in Figma file node 402:11' },
      { id: 'c2-2', description: 'Design tokens export JSON with typography and color scale', passed: true, evidence: 'tokens.json committed with WCAG AA ratios' },
    ],
  },

  // --- Milestone 3: Interactive Prototype & Copy ---
  {
    id: 't7',
    name: 'High-fidelity screen layouts',
    startDate: '2026-11-26',
    duration: 5,
    durationUnit: 'd',
    percentDone: 90,
  },
  {
    id: 't8',
    name: 'Microcopy & messaging framework',
    startDate: '2026-12-01',
    duration: 3,
    durationUnit: 'd',
    percentDone: 80,
  },
  {
    id: 't9',
    name: 'Clickable prototype & transition specs',
    startDate: '2026-12-04',
    duration: 4,
    durationUnit: 'd',
    percentDone: 70,
  },
  {
    id: 'm3',
    name: 'Milestone 3: Interactive Prototype Verified',
    startDate: '2026-12-08',
    duration: 0,
    milestone: true,
    milestoneId: 'ms-03',
    amountCents: 240000,
    paymentStatus: 'in_review',
    deliverableType: 'figma',
    acceptanceCriteria: [
      { id: 'c3-1', description: 'Clickable prototype connects all primary user interactions', passed: false, evidence: 'Reviewer currently validating prototype transitions' },
      { id: 'c3-2', description: 'All CTA copy reviewed and aligned with brand guidelines', passed: true, evidence: 'Copy document approved by client representative' },
    ],
  },

  // --- Milestone 4: Production Frontend & CMS ---
  {
    id: 't10',
    name: 'React components & layout templates',
    startDate: '2026-12-08',
    duration: 5,
    durationUnit: 'd',
    percentDone: 20,
  },
  {
    id: 't11',
    name: 'Headless CMS schema & API integration',
    startDate: '2026-12-13',
    duration: 4,
    durationUnit: 'd',
    percentDone: 0,
  },
  {
    id: 't12',
    name: 'Performance audit, SEO & QA testing',
    startDate: '2026-12-17',
    duration: 3,
    durationUnit: 'd',
    percentDone: 0,
  },
  {
    id: 'm4',
    name: 'Milestone 4: Production Launch & Settle',
    startDate: '2026-12-20',
    duration: 0,
    milestone: true,
    milestoneId: 'ms-04',
    amountCents: 260000,
    paymentStatus: 'funded',
    deliverableType: 'code_repo',
    acceptanceCriteria: [
      { id: 'c4-1', description: 'Clean deployment passes lighthouse performance > 90', passed: false },
      { id: 'c4-2', description: 'End-to-end checkout works in production staging', passed: false },
    ],
  },
];

export const sampleDependencies: SampleDependencyData[] = [
  { id: 'd1', from: 't1', to: 't2' },
  { id: 'd2', from: 't2', to: 't3' },
  { id: 'd3', from: 't3', to: 'm1' },
  { id: 'd4', from: 'm1', to: 't4' },
  { id: 'd5', from: 't4', to: 't5' },
  { id: 'd6', from: 't5', to: 't6' },
  { id: 'd7', from: 't6', to: 'm2' },
  { id: 'd8', from: 'm2', to: 't7' },
  { id: 'd9', from: 't7', to: 't8' },
  { id: 'd10', from: 't8', to: 't9' },
  { id: 'd11', from: 't9', to: 'm3' },
  { id: 'd12', from: 'm3', to: 't10' },
  { id: 'd13', from: 't10', to: 't11' },
  { id: 'd14', from: 't11', to: 't12' },
  { id: 'd15', from: 't12', to: 'm4' },
];

