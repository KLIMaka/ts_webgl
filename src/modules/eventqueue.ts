
export interface Event { };

export class EventQueue {
  private events = new Array<Event>();
  private pointer = 0;

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
    this.events[idx] = 0;
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

