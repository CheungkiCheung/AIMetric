import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('print demo runbook script', () => {
  it('contains the expected demo sequence', () => {
    const source = readFileSync(
      new URL('./print-demo-runbook.mjs', import.meta.url),
      'utf8',
    );

    expect(source).toContain('corepack pnpm demo:check');
    expect(source).toContain('corepack pnpm demo:seed');
    expect(source).toContain('dashboard-walkthrough.md');
  });
});
