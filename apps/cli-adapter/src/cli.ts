#!/usr/bin/env node

import { parseCliRecordArgs, recordCliSession } from './cli-adapter.js';

const main = async (): Promise<void> => {
  const result = await recordCliSession(parseCliRecordArgs(process.argv.slice(2)));

  console.log(
    JSON.stringify(
      {
        published: result.published,
        buffered: result.buffered ?? false,
        bufferedDepth: result.bufferedDepth ?? 0,
        events: result.batch.events.length,
        batch: result.batch,
      },
      null,
      2,
    ),
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
