import type {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '@milestone/shared';

export interface FixtureAdapterOptions {
  customResponses?: Record<string, unknown>;
  simulateRepairAttempts?: number; // number of times to return malformed output before succeeding
}

export class FixtureAdapter implements LlmPort {
  readonly provider = 'fixture';
  readonly model = 'fixture-planner-v1';
  private repairCount = 0;
  private options: FixtureAdapterOptions;

  constructor(options: FixtureAdapterOptions = {}) {
    this.options = options;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();
    const userMessage = request.messages.find((m) => m.role === 'user')?.content ?? '';
    const isRepair = request.messages.some((m) => m.content.includes('Your previous output failed validation'));

    // Check if this is a reviewer tool completion request
    const hasSubmitVerdict = request.tools?.some((t) => t.name === 'submit_verdict');
    if (hasSubmitVerdict) {
      const injectionSuspected =
        userMessage.toLowerCase().includes('ignore previous') ||
        userMessage.toLowerCase().includes('override instructions') ||
        userMessage.toLowerCase().includes('payout immediately') ||
        userMessage.toLowerCase().includes('bypass');

      const verdictPayload = {
        criteria: [
          {
            index: 0,
            result: injectionSuspected ? 'unclear' : 'pass',
            evidence: injectionSuspected ? 'Suspicious instruction pattern detected' : 'Acceptance criteria verified with high confidence',
            confidence: injectionSuspected ? 0.3 : 0.95,
          },
        ],
        verdict: injectionSuspected ? 'escalate_to_human' : 'release',
        injectionSuspected,
        feedbackForFreelancer: injectionSuspected
          ? 'Submission flagged for manual client review.'
          : 'Deliverable passed all acceptance criteria.',
      };

      return {
        content: null,
        toolCalls: [
          {
            id: 'call_fixture_verdict',
            name: 'submit_verdict',
            arguments: JSON.stringify(verdictPayload),
          },
        ],
        provider: this.provider,
        model: this.model,
        latencyMs: 15,
        inputTokens: 200,
        outputTokens: 100,
        promptVersion: 'reviewer.v1',
      };
    }

    // Check if brief is unsafe / illegal
    if (
      userMessage.toLowerCase().includes('crack password') ||
      userMessage.toLowerCase().includes('unauthorized') ||
      userMessage.toLowerCase().includes('exploit') ||
      userMessage.toLowerCase().includes('ddos') ||
      userMessage.toLowerCase().includes('malware')
    ) {
      const errorPayload = {
        error: 'Refused: The requested brief asks for activities that violate security and safety policies.',
      };
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_fixture_error',
            name: 'submit_plan',
            arguments: JSON.stringify(errorPayload),
          },
        ],
        provider: this.provider,
        model: this.model,
        latencyMs: Date.now() - startTime + 10,
        inputTokens: 150,
        outputTokens: 40,
        promptVersion: 'planner.v1',
      };
    }

    // Check if we should simulate a repair failure on initial attempt
    if (this.options.simulateRepairAttempts && !isRepair && this.repairCount < this.options.simulateRepairAttempts) {
      this.repairCount++;
      const brokenPayload = {
        projectTitle: 'Broken Plan for Testing Repair',
        summary: 'Temporary invalid plan',
        assumptions: [],
        currency: 'USD',
        totalBudget: 1000,
        tasks: [
          { id: 't1', name: 'Task with good nice clean vibes', durationDays: 1.3, dependsOn: [] }, // duration not multiple of 0.5, vague words
          { id: 't2', name: 'Task 2', durationDays: 1.0, dependsOn: ['t99'] }, // nonexistent dependency
        ],
        milestones: [
          {
            id: 'm1',
            name: 'Milestone 1',
            afterTaskIds: ['t1'],
            paymentPercent: 50, // exceeds 40%
            deliverableType: 'url',
            acceptanceCriteria: ['Good quality code'], // vague
            reviewHint: 'Check it',
          },
        ],
      };
      return {
        content: null,
        toolCalls: [
          {
            id: 'call_broken',
            name: 'submit_plan',
            arguments: JSON.stringify(brokenPayload),
          },
        ],
        provider: this.provider,
        model: this.model,
        latencyMs: 15,
        inputTokens: 120,
        outputTokens: 50,
        promptVersion: 'planner.v1',
      };
    }

    // Extract currency, total budget if present in prompt
    let totalBudget = 2500;
    const budgetMatch = /Total budget:\s*\$?([\d,]+)/i.exec(userMessage);
    if (budgetMatch) {
      totalBudget = parseFloat(budgetMatch[1].replace(/,/g, ''));
    }

    // Default high-quality valid plan
    const isDataAnalysis = userMessage.toLowerCase().includes('data') || userMessage.toLowerCase().includes('retention');
    const isMobile = userMessage.toLowerCase().includes('mobile') || userMessage.toLowerCase().includes('biometric');
    const isDocs = userMessage.toLowerCase().includes('documentation') || userMessage.toLowerCase().includes('api');

    let planPayload;
    if (isDataAnalysis) {
      planPayload = {
        projectTitle: 'Customer Retention & Churn Analytics',
        summary: 'Analyze 12 months of cohort retention, uncover churn drivers, and build predictive model',
        assumptions: [
          'Client supplies sanitized CSV or BigQuery access to anonymized event logs',
          'Bi-weekly sync meetings to review preliminary findings',
        ],
        currency: 'USD',
        totalBudget,
        tasks: [
          { id: 't1', name: 'Data ingestion and schema audit', durationDays: 2.0, dependsOn: [] },
          { id: 't2', name: 'Data hygiene, missing values, and normalization', durationDays: 1.5, dependsOn: ['t1'] },
          { id: 't3', name: 'Exploratory cohort retention analysis', durationDays: 3.0, dependsOn: ['t2'] },
          { id: 't4', name: 'Feature engineering for churn indicators', durationDays: 2.5, dependsOn: ['t3'] },
          { id: 't5', name: 'Predictive churn model training and cross-validation', durationDays: 3.0, dependsOn: ['t4'] },
          { id: 't6', name: 'Interactive executive dashboard and summary report', durationDays: 2.0, dependsOn: ['t5'] },
        ],
        milestones: [
          {
            id: 'm1',
            name: 'Dataset Validation & Ingestion',
            afterTaskIds: ['t1', 't2'],
            paymentPercent: 25,
            deliverableType: 'document',
            acceptanceCriteria: [
              'Data validation report identifies zero schema discrepancies or unhandled nulls',
              'Ingestion pipeline processes sample dataset in under 5 minutes with full integrity tests',
            ],
            reviewHint: 'Inspect the validation report and verify sample data pipeline logs',
          },
          {
            id: 'm2',
            name: 'Cohort Model & Churn Drivers',
            afterTaskIds: ['t3', 't4', 't5'],
            paymentPercent: 40,
            deliverableType: 'repo',
            acceptanceCriteria: [
              'Jupyter notebook executes end-to-end without unhandled runtime exceptions',
              'Cross-validated ROC-AUC of the churn prediction model meets or exceeds 0.78',
              'Feature importance plot accurately ranks top 5 churn risk factors',
            ],
            reviewHint: 'Execute notebook and verify model metrics table',
          },
          {
            id: 'm3',
            name: 'Dashboard & Final Presentation',
            afterTaskIds: ['t6'],
            paymentPercent: 35,
            deliverableType: 'url',
            acceptanceCriteria: [
              'Interactive dashboard URL is publicly reachable over HTTPS',
              'Executive presentation slide deck covers actionable recommendations in 15 slides',
            ],
            reviewHint: 'Open the dashboard URL and confirm cohort filters respond under 1 second',
          },
        ],
      };
    } else if (isMobile) {
      planPayload = {
        projectTitle: 'Mobile Biometric Auth & Offline Sync',
        summary: 'Integrate FaceID/TouchID authentication and SQLite offline cache sync in React Native',
        assumptions: [
          'App runs on React Native 0.73+ on iOS and Android',
          'Target API endpoints provide timestamped change feeds for sync',
        ],
        currency: 'USD',
        totalBudget,
        tasks: [
          { id: 't1', name: 'Security audit and keychain storage wrapper', durationDays: 2.0, dependsOn: [] },
          { id: 't2', name: 'Biometric prompt integration (FaceID / Fingerprint)', durationDays: 2.5, dependsOn: ['t1'] },
          { id: 't3', name: 'Local SQLite offline database schema & migrations', durationDays: 3.0, dependsOn: ['t1'] },
          { id: 't4', name: 'Bidirectional sync worker with exponential backoff', durationDays: 3.5, dependsOn: ['t2', 't3'] },
          { id: 't5', name: 'Conflict resolution strategy and audit log', durationDays: 2.0, dependsOn: ['t4'] },
          { id: 't6', name: 'End-to-end device testing on iOS and Android', durationDays: 2.0, dependsOn: ['t5'] },
        ],
        milestones: [
          {
            id: 'm1',
            name: 'Biometric Keychain Authentication',
            afterTaskIds: ['t1', 't2'],
            paymentPercent: 30,
            deliverableType: 'repo',
            acceptanceCriteria: [
              'Biometric authentication falls back to device passcode after 3 failed attempts',
              'Unit tests for SecureStore wrapper pass with 100% branch coverage',
            ],
            reviewHint: 'Inspect biometric auth wrapper and verify test suite',
          },
          {
            id: 'm2',
            name: 'Offline Sync Engine',
            afterTaskIds: ['t3', 't4'],
            paymentPercent: 40,
            deliverableType: 'repo',
            acceptanceCriteria: [
              'App creates and edits records in Airplane mode and flushes queue on reconnect',
              'Sync worker handles network timeouts with idempotency headers',
            ],
            reviewHint: 'Run offline sync integration test suite in repository',
          },
          {
            id: 'm3',
            name: 'Conflict Resolution & Release Build',
            afterTaskIds: ['t5', 't6'],
            paymentPercent: 30,
            deliverableType: 'url',
            acceptanceCriteria: [
              'Expo or TestFlight build URL installs without errors on test devices',
              'Conflict resolution tests demonstrate zero data overwrite on simultaneous edits',
            ],
            reviewHint: 'Download release preview build and test on device',
          },
        ],
      };
    } else if (isDocs) {
      planPayload = {
        projectTitle: 'Developer API Documentation & SDK Guides',
        summary: 'Author comprehensive OpenAPI 3.1 specification, developer quickstarts, and Postman collection',
        assumptions: [
          'Backend team provides existing Swagger JSON or endpoint routes',
          'Mintlify or Docusaurus used for docs hosting',
        ],
        currency: 'USD',
        totalBudget,
        tasks: [
          { id: 't1', name: 'Endpoint audit and OpenAPI 3.1 spec drafting', durationDays: 2.5, dependsOn: [] },
          { id: 't2', name: 'Request/response schema examples and error codes', durationDays: 2.0, dependsOn: ['t1'] },
          { id: 't3', name: 'Interactive Postman collection with test scripts', durationDays: 2.0, dependsOn: ['t1'] },
          { id: 't4', name: 'Authentication and rate limiting guide', durationDays: 1.5, dependsOn: ['t2'] },
          { id: 't5', name: 'Language SDK quickstart snippets (TypeScript, Python, cURL)', durationDays: 2.5, dependsOn: ['t3', 't4'] },
          { id: 't6', name: 'Docs site deployment and search indexing', durationDays: 1.5, dependsOn: ['t5'] },
        ],
        milestones: [
          {
            id: 'm1',
            name: 'OpenAPI Specification & Postman Suite',
            afterTaskIds: ['t1', 't2', 't3'],
            paymentPercent: 35,
            deliverableType: 'repo',
            acceptanceCriteria: [
              'OpenAPI 3.1 YAML passes spectral validation with zero errors or warnings',
              'Postman collection executes 20 sample requests against sandbox environment',
            ],
            reviewHint: 'Run spectral lint on openapi.yaml and review Postman export',
          },
          {
            id: 'm2',
            name: 'Guides & Multi-Language Quickstarts',
            afterTaskIds: ['t4', 't5'],
            paymentPercent: 35,
            deliverableType: 'document',
            acceptanceCriteria: [
              'Quickstart guides include runnable copy-paste examples in TypeScript and Python',
              'Authentication guide details OAuth2 token exchange and error responses',
            ],
            reviewHint: 'Review markdown documentation in guides directory',
          },
          {
            id: 'm3',
            name: 'Published Developer Portal',
            afterTaskIds: ['t6'],
            paymentPercent: 30,
            deliverableType: 'url',
            acceptanceCriteria: [
              'Documentation site URL is live over HTTPS with working search bar',
              'All interactive API playground endpoints return valid responses',
            ],
            reviewHint: 'Open docs site and test search query',
          },
        ],
      };
    } else {
      // Default: Web design & landing page redesign
      planPayload = {
        projectTitle: 'Brand Landing Page & Conversion Flow',
        summary: 'High-converting responsive landing page, interactive pricing calculator, and onboarding funnel',
        assumptions: [
          'Client provides brand guidelines, vector logo, and copy outline',
          'Production site deployed to Vercel or Netlify with custom domain',
        ],
        currency: 'USD',
        totalBudget,
        tasks: [
          { id: 't1', name: 'Information architecture and wireframing', durationDays: 2.0, dependsOn: [] },
          { id: 't2', name: 'Design system tokens and responsive UI components', durationDays: 3.0, dependsOn: ['t1'] },
          { id: 't3', name: 'Hero section and feature showcase layout', durationDays: 2.5, dependsOn: ['t2'] },
          { id: 't4', name: 'Interactive pricing calculator and tier comparison', durationDays: 2.0, dependsOn: ['t3'] },
          { id: 't5', name: 'Signup form with client-side validation and email integration', durationDays: 2.5, dependsOn: ['t3'] },
          { id: 't6', name: 'Cross-browser testing, accessibility audit, and deployment', durationDays: 1.5, dependsOn: ['t4', 't5'] },
        ],
        milestones: [
          {
            id: 'm1',
            name: 'Wireframes & Design System',
            afterTaskIds: ['t1', 't2'],
            paymentPercent: 25,
            deliverableType: 'url',
            acceptanceCriteria: [
              'Figma or Storybook URL contains responsive layouts for desktop (1440px) and mobile (390px)',
              'Design token specification defines typography scale, spacing grid, and color palette',
            ],
            reviewHint: 'Inspect Figma or component preview URL',
          },
          {
            id: 'm2',
            name: 'Interactive Pages & Features',
            afterTaskIds: ['t3', 't4', 't5'],
            paymentPercent: 40,
            deliverableType: 'repo',
            acceptanceCriteria: [
              'Pricing calculator updates dynamically when toggling annual vs monthly billing',
              'Signup form validates email syntax and prevents submission with invalid inputs',
              'Automated end-to-end tests pass across Chromium and Mobile Safari viewports',
            ],
            reviewHint: 'Run tests in repository and review pricing component',
          },
          {
            id: 'm3',
            name: 'Production Launch & Verification',
            afterTaskIds: ['t6'],
            paymentPercent: 35,
            deliverableType: 'url',
            acceptanceCriteria: [
              'Production URL returns HTTP 200 with valid SSL certificate',
              'Lighthouse Accessibility score is at least 95 with zero missing alt tags',
            ],
            reviewHint: 'Visit production URL and run Lighthouse report',
          },
        ],
      };
    }

    return {
      content: null,
      toolCalls: [
        {
          id: 'call_fixture_plan',
          name: 'submit_plan',
          arguments: JSON.stringify(planPayload),
        },
      ],
      provider: this.provider,
      model: this.model,
      latencyMs: Date.now() - startTime + 25,
      inputTokens: 420,
      outputTokens: 380,
      promptVersion: 'planner.v1',
    };
  }
}

