export class LocalEventBuffer<T = unknown> {
  private readonly queue: T[] = [];

  push(event: T) {
    this.queue.push(event);
  }

  flush() {
    return this.queue.splice(0, this.queue.length);
  }
}
