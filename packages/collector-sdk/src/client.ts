import { LocalEventBuffer } from './buffer.js';

export class CollectorClient<T = unknown> {
  constructor(private readonly buffer = new LocalEventBuffer<T>()) {}

  enqueue(event: T) {
    this.buffer.push(event);
  }

  flush() {
    return this.buffer.flush();
  }
}
