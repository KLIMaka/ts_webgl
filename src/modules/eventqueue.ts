
export interface Event { };
export type EventConsumer<T> = (event: Event, ctx: T) => boolean;

export class EventQueue {
  private events = new Array<Event>();
  private pointer = 0;

  public tryConsume<T>(consumer: EventConsumer<T>, ctx: T) {
    for (let i = this.first(); i != -1; i = this.next(i)) {
      let e = this.get(i);
      if (consumer(e, ctx)) this.consume(i)
    }
  }

  public get(idx: number): Event {
    return this.events[idx];
  }

  public first(): number {
    return this.next(-1);
  }

  public next(lastIdx: number): number {
    for (let i = lastIdx + 1; i < this.pointer; i++) if (this.events[i] != null) return i;
    return -1;
  }

  public consume(idx: number) {
    this.events[idx] = null;
  }

  public clear() {
    this.pointer = 0;
  }

  public add(event: Event) {
    this.events[this.pointer++] = event;
  }

  public isEmpty() {
    return this.pointer == 0;
  }
}

