#!/usr/bin/env node

import { parseCursorSyncArgs, syncCursorSessions } from './cursor-sync.js';

const main = async (): Promise<void> => {
  const result = await syncCursorSessions(parseCursorSyncArgs(process.argv.slice(2)));

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
