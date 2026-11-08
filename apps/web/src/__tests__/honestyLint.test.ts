import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PROHIBITED_WORDS = ['escrow', 'guarantee', 'protected', 'insured', 'secure payments'];

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

describe('Honesty Lint Test (docs/UI_IMPLEMENTATION.md §0.6 & §13)', () => {
  it('ensures no user-facing UI code uses prohibited deceptive wording', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = findFiles(srcDir, ['.tsx', '.ts', '.html']).filter(
      (f) => !f.includes('honestyLint.test.ts')
    );

    const violations: Array<{ file: string; line: number; word: string; text: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((lineText, idx) => {
        // Skip comments and imports
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        for (const word of PROHIBITED_WORDS) {
          // Check for word boundaries
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          if (regex.test(lineText)) {
            violations.push({
              file: path.relative(srcDir, file),
              line: idx + 1,
              word,
              text: trimmed,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.word}] ${v.file}:${v.line} -> "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found prohibited wording (violates honesty rules: use "held for this project" instead):\n${summary}`
      );
    }
  });
});

