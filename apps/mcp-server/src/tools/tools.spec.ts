import { describe, expect, it } from 'vitest';
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
