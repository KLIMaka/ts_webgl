
export interface Collection<T> {
  get(i: number): T;
  length(): number;
}

export class Deck<T> implements Collection<T>{
  protected pointer = 0;
  protected array: T[];

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

export class IndexedDeck<T> extends Deck<T>{
  private index = new Map<T, number>();

  public get(i: number) {
    return this.array[i];
  }

  public push(value: T): IndexedDeck<T> {
    super.push(value);
    this.array[this.pointer] = value;
    return this;
  }

  public clear(): IndexedDeck<T> {
    super.clear();
    this.index.clear();
    return this;
  }

  public indexOf(value: T) {
    let idx = this.index.get(value);
    return idx == undefined ? -1 : idx;
  }
}