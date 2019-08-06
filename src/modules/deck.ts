
export interface Collection<T> {
  get(i: number): T;
  length(): number;
}

export class IndexedDeck<T> implements Collection<T>{
  private pointer = 0;
  private array: T[] = [];
  private index = new Map<T, number>();

  public get(i: number) {
    return this.array[i];
  }

  public push(value: T): IndexedDeck<T> {
    this.index.set(value, this.pointer);
    this.array[this.pointer++] = value;
    return this;
  }

  public clear(): IndexedDeck<T> {
    this.pointer = 0;
    this.index.clear();
    return this;
  }

  public length() {
    return this.pointer;
  }

  public indexOf(value: T) {
    let idx = this.index.get(value);
    return idx == undefined ? -1 : idx;
  }
}

export class Deck<T> implements Collection<T>{
  private pointer = 0;
  private array: T[];

  constructor(size: number = 10) {
    this.array = new Array<T>(size);
  }

  public get(i: number) {
    return this.array[i];
  }

  public push(value: T): Deck<T> {
    this.array[this.pointer++] = value;
    return this;
  }

  public clear(): Deck<T> {
    this.pointer = 0;
    return this;
  }

  public length() {
    return this.pointer;
  }
}