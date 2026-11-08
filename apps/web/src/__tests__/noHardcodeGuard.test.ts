import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Known hardcoded patterns forbidden in user-facing production UI code per LIVE_PROOF.md §1.6
const DEMO_NAMES_REGEX = /\b(Brand-site|Acme|Arjun|Maya)\b/i;
const CURRENCY_LITERAL_REGEX = /\$\s?\d[\d,]*(?:\.\d{2})?/;
const MOCK_OR_FIXTURE_REGEX = /\b(mock|fixture)\b/i;

// Allow-list of specific files and lines with mandatory justification comment per entry (§1.6)
interface AllowedMatch {
  file: string;
  pattern: 'currency' | 'demo_name' | 'mock_or_fixture';
  reason: string;
}

const ALLOW_LIST: AllowedMatch[] = [
  {
    // Allowed marketing illustration per §1.2: explicitly labeled "Sample ledger" / "Sample project"
    file: 'pages/LandingPage.tsx',
    pattern: 'currency',
    reason: 'Permitted marketing illustration labeled Sample Project Ledger per §1.2',
  },
  {
    // Dev-only styleguide route for design token and component regression testing
    file: 'pages/StyleguidePage.tsx',
    pattern: 'currency',
    reason: 'Dev-only styleguide showcasing components; excluded from customer flow',
  },
  {
    // Dev-only styleguide route for design token and component regression testing
    file: 'pages/StyleguidePage.tsx',
    pattern: 'mock_or_fixture',
    reason: 'Dev-only styleguide testing badge components; excluded from customer flow',
  },
  {
    // Honest prototype disclosure: displays "Fixture Replay" badge when backend reports plan was fixture-generated
    file: 'components/PlanReviewScreen.tsx',
    pattern: 'mock_or_fixture',
    reason: 'Mandatory honesty badge disclosing plan fixture provenance to evaluator',
  },
  {
    // Evaluator demo persona switcher on /?workspace=true per M0/M1 spec and Section 2
    file: 'App.tsx',
    pattern: 'demo_name',
    reason: 'Demo persona button "Client (Acme Corp)" on root workspace view',
  },
  {
    // Evaluator split demo tool per Section 2 and UI Implementation §11
    file: 'pages/demo/SplitDemoPage.tsx',
    pattern: 'demo_name',
    reason: 'Evaluator split demo view showing Sarah Lin (Acme Corp) and Arjun Mehta panes',
  },
  {
    // Evaluator demo bar guidance and credentials per Section 2 and UI Implementation §11
    file: 'components/ui/DemoBar.tsx',
    pattern: 'demo_name',
    reason: 'Evaluator demo guidance bar showing sandbox buyer and demo persona credentials',
  },
  {
    // Evaluator demo deliverable presets (Good Delivery, Weak Delivery, Injection) per LIVE_PROOF.md §1.6
    file: 'components/freelancer/SubmitSlideOver.tsx',
    pattern: 'demo_name',
    reason: 'Evaluator 1-click deliverable presets for testing automated review in demo mode',
  },
];

function findFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        results = results.concat(findFiles(fullPath, extensions));
      }
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

describe('No Hardcode CI Guard Test (docs/LIVE_PROOF.md §1.6)', () => {
  it('ensures apps/web/src contains zero hardcoded currency literals, demo names, or mock/fixture identifiers', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = findFiles(srcDir, ['.tsx', '.ts', '.html']).filter(
      (f) =>
        !f.includes(path.sep + '__tests__' + path.sep) &&
        !f.includes(path.sep + 'marketing' + path.sep) &&
        !f.includes(path.sep + 'landing' + path.sep) &&
        !f.endsWith('.test.ts') &&
        !f.endsWith('.test.tsx') &&
        !f.endsWith('.spec.ts') &&
        !f.endsWith('.spec.tsx')
    );

    const violations: Array<{ file: string; line: number; rule: string; text: string }> = [];

    for (const file of files) {
      const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((lineText, idx) => {
        const trimmed = lineText.trim();
        // Skip comment lines and import paths
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('import ')
        ) {
          return;
        }

        // 1. Check demo names (Acme, Arjun, Maya, Brand-site)
        if (DEMO_NAMES_REGEX.test(trimmed)) {
          const isAllowed = ALLOW_LIST.some(
            (entry) => relPath === entry.file && entry.pattern === 'demo_name'
          );
          if (!isAllowed) {
            violations.push({
              file: relPath,
              line: idx + 1,
              rule: 'DEMO_NAME',
              text: trimmed,
            });
          }
        }

        // 2. Check currency literals ($1,200, $8,000.00, etc.)
        if (CURRENCY_LITERAL_REGEX.test(trimmed)) {
          const isAllowed = ALLOW_LIST.some(
            (entry) => relPath === entry.file && entry.pattern === 'currency'
          );
          if (!isAllowed) {
            violations.push({
              file: relPath,
              line: idx + 1,
              rule: 'CURRENCY_LITERAL',
              text: trimmed,
            });
          }
        }

        // 3. Check mock or fixture identifiers
        if (MOCK_OR_FIXTURE_REGEX.test(trimmed)) {
          const isAllowed = ALLOW_LIST.some(
            (entry) => relPath === entry.file && entry.pattern === 'mock_or_fixture'
          );
          if (!isAllowed) {
            violations.push({
              file: relPath,
              line: idx + 1,
              rule: 'MOCK_OR_FIXTURE',
              text: trimmed,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.rule}] ${v.file}:${v.line} -> "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found hardcoded data violating LIVE_PROOF.md §1.6:\n${summary}\n\nAll numbers, names, and statuses must derive from the live database or PayPal API.`
      );
    }
  });
});

