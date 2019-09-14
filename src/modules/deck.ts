import { Iterator, ForwardIterator, BackIterator } from "./iterator";

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

  public pushAll(values: Collection<T>): Deck<T> {
    for (let i = 0; i < values.length(); i++)
      this.push(values.get(i));
    return this;
  }

  public pop(): Deck<T> {
    this.pointer--;
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

  public push(value: T): IndexedDeck<T> {
    super.push(value);
    this.index.set(value, this.pointer);
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

export class DeckIterator<T> implements Iterator<T>, ForwardIterator, BackIterator {
  constructor(private deck: Deck<T>, private idx: number = 0) { }
  get(): T { return this.deck.get(this.idx); }
  next(): void { this.idx++; }
  back(): void { this.idx--; }
  eq(iter: DeckIterator<T>): boolean { return this.deck === iter.deck && this.idx === iter.idx; }
}

export function findFirst<T>(collection: Collection<T>, value: T, start = 0) {
  for (let i = start; i < collection.length(); i++) {
    if (collection.get(i) == value) return i;
  }
  return -1;
}

export function reversed<T>(collection: Collection<T>): Collection<T> {
  let length = collection.length();
  return {
    get: (i: number) => { return collection.get(length - 1 - i) },
    length: () => { return length }
  }
}