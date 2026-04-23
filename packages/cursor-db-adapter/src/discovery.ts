import { join } from 'node:path';

export interface CursorDataRoots {
  cursorProjectsDir: string;
  workspaceStorageDir: string;
  globalStorageDir: string;
}

export interface ResolveCursorDataRootsInput {
  platform: NodeJS.Platform;
  homeDir: string;
  appDataDir?: string;
  overrides: Partial<{
    cursorProjectsDir: string;
    cursorWorkspaceStorageDir: string;
    cursorGlobalStorageDir: string;
  }>;
}

export function resolveCursorDataRoots(
  input: ResolveCursorDataRootsInput,
): CursorDataRoots {
  const userDirectory =
    input.platform === 'win32'
      ? join(input.appDataDir ?? join(input.homeDir, 'AppData', 'Roaming'), 'Cursor', 'User')
      : input.platform === 'darwin'
        ? join(
            input.homeDir,
            'Library',
            'Application Support',
            'Cursor',
            'User',
          )
        : join(input.homeDir, '.config', 'Cursor', 'User');

  return {
    cursorProjectsDir:
      input.overrides.cursorProjectsDir ?? join(input.homeDir, '.cursor', 'projects'),
    workspaceStorageDir:
      input.overrides.cursorWorkspaceStorageDir ??
      join(userDirectory, 'workspaceStorage'),
    globalStorageDir:
      input.overrides.cursorGlobalStorageDir ?? join(userDirectory, 'globalStorage'),
  };
}
