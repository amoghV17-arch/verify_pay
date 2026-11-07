// Canonical fallback data matching apps/api/src/db/seed.ts for offline preview and resilient E2E runs

export const FALLBACK_PROJECT = {
  id: 'proj_brand_launch',
  title: 'Brand-site Redesign & Launch',
  brief: 'Comprehensive brand redesign and modern web deployment for Acme Corp including strategy, visual identity system, Next.js marketing site, and CMS integration.',
  totalCents: 800000,
  status: 'active',
  clientId: 'user_client_01',
  freelancerId: 'user_freelancer_01',
  autonomyMode: 'assisted' as const,
  releaseWindowSeconds: 30,
  isDemo: true,
  createdAt: '2026-11-01T10:00:00.000Z',
};

export const FALLBACK_FREELANCER = {
  name: 'Arjun Mehta',
  email: 'arjun@example.com',
};

export const FALLBACK_MILESTONES = [
  {
    id: 'ms-01',
    name: 'Milestone 1: Brand Strategy Approved',
    amountCents: 120000,
    status: 'paid',
    deliverableType: 'document',
    acceptanceCriteria: [
      'At least 5 customer interview summaries documented',
      'Positioning matrix comparing Acme against top 3 competitors',
      'Brand messaging guide covering mission, vision, and elevator pitch',
    ],
  },
  {
    id: 'ms-02',
    name: 'Milestone 2: Design System & Component Library',
    amountCents: 200000,
    status: 'approved',
    deliverableType: 'document',
    acceptanceCriteria: [
      'Figma design system published with primary and secondary color tokens',
      'WCAG AAA contrast verified on all text colors',
      'At least 12 reusable UI components documented with interactive variants',
    ],
  },
  {
    id: 'ms-03',
    name: 'Milestone 3: Marketing Site Frontend Implementation',
    amountCents: 240000,
    status: 'in_review',
    deliverableType: 'url',
    acceptanceCriteria: [
      'Production deployment live at vercel.app or netlify.app with valid SSL',
      'Lighthouse mobile performance score >= 90',
      'Contact form connects to lead capture webhook returning HTTP 200',
    ],
  },
  {
    id: 'ms-04',
    name: 'Milestone 4: CMS Integration & Final Launch Handoff',
    amountCents: 240000,
    status: 'funded',
    deliverableType: 'repo',
    acceptanceCriteria: [
      'GitHub repository transferred or client invited as admin',
      'README contains verified local setup instructions tested on fresh machine',
      'Sanity CMS or Strapi schema and seed scripts merged to main',
    ],
  },
];

export const FALLBACK_LEDGER = {
  totalCents: 800000,
  fundedCents: 800000,
  paidCents: 120000,
  heldCents: 680000,
  entries: [
    {
      id: 'ledg_01',
      type: 'funded',
      amountCents: 800000,
      timestamp: '2026-11-01T10:15:00.000Z',
      paypalCaptureId: 'CAPTURE-8K-SANDBOX-01',
    },
    {
      id: 'ledg_02',
      type: 'holding',
      amountCents: 800000,
      timestamp: '2026-11-01T10:15:01.000Z',
      referenceId: 'HOLD-SANDBOX-MOCK',
    },
    {
      id: 'ledg_03',
      type: 'released',
      amountCents: 120000,
      timestamp: '2026-11-03T16:30:00.000Z',
      milestoneId: 'ms-01',
      paypalPayoutBatchId: 'BATCH-PAYOUT-MS01-MOCK',
    },
  ],
};

export const FALLBACK_DELIVERABLES = [
  {
    id: 'deliv_01',
    milestoneId: 'ms-01',
    kind: 'document',
    payload: { documentUrl: 'https://docs.acme.com/brand-strategy-v1.pdf' },
    submittedAt: '2026-11-03T15:00:00.000Z',
  },
  {
    id: 'deliv_02',
    milestoneId: 'ms-02',
    kind: 'document',
    payload: { documentUrl: 'https://figma.com/file/acme-design-system' },
    submittedAt: '2026-11-05T11:00:00.000Z',
  },
  {
    id: 'deliv_03',
    milestoneId: 'ms-03',
    kind: 'url',
    payload: { url: 'https://acme-staging.vercel.app' },
    submittedAt: '2026-11-07T09:30:00.000Z',
  },
];

export const FALLBACK_REVIEWS = [
  {
    id: 'rev_01',
    milestoneId: 'ms-01',
    verdict: 'pass' as const,
    confidence: 0.96,
    reasoning: 'All 3 criteria satisfied with observable evidence documented in research PDF.',
    evaluatedCriteria: [
      { id: 'c1-1', satisfied: true, reasoning: '5 customer interviews verified.' },
      { id: 'c1-2', satisfied: true, reasoning: 'Positioning matrix verified.' },
      { id: 'c1-3', satisfied: true, reasoning: 'Messaging guide verified.' },
    ],
  },
  {
    id: 'rev_02',
    milestoneId: 'ms-02',
    verdict: 'pass' as const,
    confidence: 0.94,
    reasoning: 'Design system and WCAG AAA color contrast verified on component library.',
    evaluatedCriteria: [
      { id: 'c2-1', satisfied: true, reasoning: 'Figma tokens verified.' },
      { id: 'c2-2', satisfied: true, reasoning: 'WCAG AAA contrast verified.' },
      { id: 'c2-3', satisfied: true, reasoning: '12 reusable components verified.' },
    ],
  },
  {
    id: 'rev_03',
    milestoneId: 'ms-03',
    verdict: 'pass' as const,
    confidence: 0.88,
    reasoning: 'Evaluation in progress: checking Lighthouse mobile performance score.',
    evaluatedCriteria: [
      { id: 'c3-1', satisfied: true, reasoning: 'Live URL with SSL verified.' },
      { id: 'c3-2', satisfied: true, reasoning: 'Lighthouse audit running.' },
      { id: 'c3-3', satisfied: true, reasoning: 'Form webhook verified.' },
    ],
  },
];

export const FALLBACK_ACTIVITY = [
  {
    id: 'act_01',
    projectId: 'proj_brand_launch',
    actor: 'client',
    type: 'project_created',
    description: 'Sarah Lin created project agreement "Brand-site Redesign & Launch"',
    timestamp: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'act_02',
    projectId: 'proj_brand_launch',
    actor: 'freelancer',
    type: 'invite_accepted',
    description: 'Arjun Mehta accepted the project agreement and milestones schedule',
    timestamp: '2026-11-01T10:10:00.000Z',
  },
  {
    id: 'act_03',
    projectId: 'proj_brand_launch',
    actor: 'paypal',
    type: 'funding_captured',
    description: 'PayPal sandbox captured $8,000.00 into project holding balance',
    timestamp: '2026-11-01T10:15:00.000Z',
  },
  {
    id: 'act_04',
    projectId: 'proj_brand_launch',
    actor: 'ai',
    type: 'review_completed',
    description: 'Reviewer agent verified Milestone 1 deliverable with 96% confidence',
    timestamp: '2026-11-03T15:45:00.000Z',
  },
  {
    id: 'act_05',
    projectId: 'proj_brand_launch',
    actor: 'paypal',
    type: 'payout_released',
    description: 'PayPal sandbox payout released $1,200.00 to Arjun Mehta for Milestone 1',
    timestamp: '2026-11-03T16:30:00.000Z',
  },
];

