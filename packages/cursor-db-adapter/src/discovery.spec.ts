import { describe, expect, it } from 'vitest';
import { resolveCursorDataRoots } from './discovery.js';

describe('resolveCursorDataRoots', () => {
  it('returns explicit Cursor directories before platform defaults', () => {
    expect(
      resolveCursorDataRoots({
        platform: 'darwin',
        homeDir: '/Users/alice',
        overrides: {
          cursorProjectsDir: '/tmp/projects',
        },
      }),
    ).toEqual({
      cursorProjectsDir: '/tmp/projects',
      workspaceStorageDir:
        '/Users/alice/Library/Application Support/Cursor/User/workspaceStorage',
      globalStorageDir:
        '/Users/alice/Library/Application Support/Cursor/User/globalStorage',
    });
  });

  it('uses appDataDir for Windows defaults when provided', () => {
    expect(
      resolveCursorDataRoots({
        platform: 'win32',
        homeDir: 'C:/Users/alice',
        appDataDir: 'C:/Users/alice/AppData/Roaming',
        overrides: {},
      }),
    ).toEqual({
      cursorProjectsDir: 'C:/Users/alice/.cursor/projects',
      workspaceStorageDir:
        'C:/Users/alice/AppData/Roaming/Cursor/User/workspaceStorage',
      globalStorageDir:
        'C:/Users/alice/AppData/Roaming/Cursor/User/globalStorage',
    });
  });
});
