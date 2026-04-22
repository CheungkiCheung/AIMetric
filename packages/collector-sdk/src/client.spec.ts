import { describe, expect, it } from 'vitest';
import { LocalEventBuffer } from './buffer.js';

describe('LocalEventBuffer', () => {
  it('stores and flushes buffered events in FIFO order', () => {
    const buffer = new LocalEventBuffer<{ id: string }>();
    buffer.push({ id: '1' });
    buffer.push({ id: '2' });

    expect(buffer.flush()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
