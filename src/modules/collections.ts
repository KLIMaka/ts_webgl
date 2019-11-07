import { cyclic } from "../libs/mathutils";

export interface Collection<T> extends Iterable<T> {
  get(i: number): T;
  length(): number;
  isEmpty(): boolean;
}

export interface MutableCollection<T> extends Collection<T> {
  set(idx: number, value: T): void;
}

export const TERMINAL_ITERATOR_RESULT: IteratorResult<any> = { value: null, done: true };
export const EMPTY_ITERATOR = { next: () => TERMINAL_ITERATOR_RESULT };
export const EMPTY_COLLECTION: MutableCollection<any> = {
  get: (i: number) => undefined,
  length: () => 0,
  [Symbol.iterator]: () => EMPTY_ITERATOR,
  isEmpty: () => true,
  set: (i: number, v: any) => { }
}

function iteratorResult<T>(isDone: boolean, val: T): IteratorResult<T> {
  return isDone ? TERMINAL_ITERATOR_RESULT : { done: false, value: val };
}

export class Deck<T> implements MutableCollection<T>{
  protected pointer = 0;
  protected array: T[];

  constructor(size: number = 10) {
    this.array = new Array<T>(size);
  }

  public get(i: number) {
    return this.array[i];
  }

  public set(i: number, value: T) {
    if (i >= this.pointer) throw new Error(`Invalid set position: ${i} >= ${this.pointer}`);
    this.array[i] = value;
  }

  public push(value: T): Deck<T> {
    this.array[this.pointer++] = value;
    return this;
  }

  public pushAll(values: Collection<T>): Deck<T> {
    for (let val of values) this.push(val);
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

  public isEmpty() {
    return this.pointer == 0;
  }

  public clone() {
    let copy = new Deck<T>();
    copy.array = [...this.array];
    copy.pointer = this.pointer;
    return copy;
  }

  public [Symbol.iterator]() {
    let i = 0;
    return this.pointer == 0
      ? EMPTY_ITERATOR
      : { next: () => { return iteratorResult(i == this.pointer, this.array[i++]) } }
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

export function findFirst<T>(collection: Collection<T>, value: T, start = 0) {
  for (let i = start; i < collection.length(); i++) {
    if (collection.get(i) == value) return i;
  }
  return -1;
}

export function reversed<T>(collection: Collection<T>): Collection<T> {
  let length = collection.length();
  let i = length - 1;
  return length == 0
    ? EMPTY_COLLECTION
    : {
      get: (i: number) => collection.get(length - 1 - i),
      length: () => length,
      isEmpty: () => length == 0,
      [Symbol.iterator]: () => { return { next: () => iteratorResult(i < 0, collection.get(i--)) } }
    }
}

export function indexedIterator<T>(c: Collection<T>): Iterable<[T, number]> {
  let length = c.length();
  let i = 0;
  return length == 0
    ? EMPTY_COLLECTION
    : { [Symbol.iterator]: () => { return { next: () => iteratorResult(i == length, [c.get(i), i++]) } } }
}

export function cyclicPairs<T>(length: number): Iterable<[number, number]> {
  let i = 0;
  return length == 0
    ? EMPTY_COLLECTION
    : { [Symbol.iterator]: () => { return { next: () => iteratorResult(i == length, [i++, cyclic(i, length)]) } } }
}
