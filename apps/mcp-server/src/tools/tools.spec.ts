import { describe, expect, it } from 'vitest';
import { getProjectRules } from './get-project-rules.tool.js';
import { searchKnowledge } from './search-knowledge.tool.js';
import { beforeEditFile } from './before-edit-file.tool.js';
import { afterEditFile } from './after-edit-file.tool.js';
import { recordSession } from './record-session.tool.js';

describe('beforeEditFile', () => {
  it('captures a stable pre-edit snapshot', async () => {
    const result = await beforeEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      content: 'const a = 1;'
    });

    expect(result.filePath).toBe('/tmp/demo.ts');
    expect(result.snapshotHash).toBeDefined();
  });
});

describe('afterEditFile', () => {
  it('produces a normalized diff payload', async () => {
    const result = await afterEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;'
    });

    expect(result.diff).toContain('-const a = 1;');
    expect(result.diff).toContain('+const a = 2;');
  });
});

describe('recordSession', () => {
  it('captures a lightweight session summary', async () => {
    const result = await recordSession({
      sessionId: 'sess_1',
      userMessage: 'change the file',
      assistantMessage: 'file changed'
    });

    expect(result.sessionId).toBe('sess_1');
    expect(result.summary).toContain('change the file');
  });
});

describe('getProjectRules', () => {
  it('returns article-congruent project rules for the current project', async () => {
    const result = await getProjectRules({
      projectKey: 'aimetric',
      toolType: 'cursor',
      sceneType: 'api-change',
    });

    expect(result.projectKey).toBe('aimetric');
    expect(result.mandatoryRules).toContain('core.style');
    expect(result.knowledgeRefs).toContain(
      'docs/superpowers/specs/2026-04-22-aimetric-article-congruent-design.md',
    );
  });
});

describe('searchKnowledge', () => {
  it('finds matching knowledge snippets from local docs', async () => {
    const result = await searchKnowledge({
      query: '规则分层',
      limit: 2,
    });

    expect(result.query).toBe('规则分层');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.filePath).toContain('docs/superpowers');
  });
});
