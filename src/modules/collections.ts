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

export function iteratorResult<T>(isDone: boolean, val: T): IteratorResult<T> {
  return isDone ? TERMINAL_ITERATOR_RESULT : { done: false, value: val };
}

export class ArrayWrapper<T> implements MutableCollection<T> {
  constructor(private array: T[], private len: number = array.length) { };
  get(i: number) { return this.array[i] }
  length() { return this.len }
  [Symbol.iterator]() { return this.array.values(); }
  isEmpty() { return this.len == 0 }
  set(i: number, value: T) { this.array[i] = value }
}
export function wrap<T>(array: T[], len: number = array.length) { return new ArrayWrapper(array, len) }

export class DecoratedCollection<T, U> implements Collection<T> {
  constructor(
    protected values: Collection<U>,
    private getter: (o: U) => T
  ) { }
  get(i: number) { return this.getter(this.values.get(i)) }
  length() { return this.values.length() }
  isEmpty() { return this.values.isEmpty() }
  [Symbol.iterator]() {
    let i = 0;
    return this.length() == 0
      ? EMPTY_ITERATOR
      : { next: () => { return iteratorResult(i == this.length(), this.get(i++)) } }
  }
}
export function decorate<T, U>(values: Collection<U>, getter: (o: U) => T): DecoratedCollection<T, U> {
  return new DecoratedCollection(values, getter);
}

export class DecoratedMutableCollection<T, U> extends DecoratedCollection<T, U> implements MutableCollection<T> {
  constructor(values: Collection<U>, getter: (o: U) => T, private setter: (o: U, v: T) => void) { super(values, getter) }
  set(i: number, value: T) { this.setter(this.values.get(i), value) }
}
export function decorateMutable<T, U>(values: Collection<U>, getter: (o: U) => T, setter: (o: U, v: T) => void): DecoratedMutableCollection<T, U> {
  return new DecoratedMutableCollection(values, getter, setter);
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

  public pushAll(values: Iterable<T>): Deck<T> {
    for (let val of values) this.push(val);
    return this;
  }

  public pop(): Deck<T> {
    this.pointer--;
    return this;
  }

  public top(): T {
    return this.array[this.pointer - 1];
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
    if (this.index.has(value)) return this;
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

  public hasAny(i: Iterable<T>): boolean {
    for (const v of i) if (this.indexOf(v) != -1) return true;
    return false;
  }
}

export function findFirst<T>(collection: Collection<T>, value: T, start = 0) {
  for (let i = start; i < collection.length(); i++) {
    if (collection.get(i) == value) return i;
  }
  return -1;
}

export function reverse<T>(c: Collection<T>): Collection<T> {
  return c.isEmpty()
    ? EMPTY_COLLECTION
    : {
      get: (i: number) => c.get(c.length() - 1 - i),
      length: () => c.length(),
      isEmpty: () => false,
      [Symbol.iterator]: () => reversed(c)
    }
}

export function subCollection<T>(c: Collection<T>, start: number, length: number): Collection<T> {
  return length == 0
    ? EMPTY_COLLECTION
    : {
      get: (i: number) => c.get(start + i),
      length: () => length,
      isEmpty: () => false,
      [Symbol.iterator]: () => sub(c, start, length)
    }
}

export function* filter<T>(i: Iterable<T>, f: (t: T) => boolean): Generator<T> {
  for (const v of i) if (f(v)) yield v;
}

export function* map<T, V>(i: Iterable<T>, f: (t: T) => V): Generator<V> {
  for (const v of i) yield f(v);
}

export function* sub<T>(c: Collection<T>, start: number, length: number): Generator<T> {
  for (let i = 0; i < length; i++) yield c.get(start + i);
}

export function* reversed<T>(c: Collection<T>): Generator<T> {
  for (let i = c.length() - 1; i >= 0; i--) yield c.get(i);
}

export function* indexed<T>(c: Collection<T>): Generator<[T, number]> {
  for (let i = 0; i < c.length(); i++) yield [c.get(i), i];
}

export function* range(start: number, end: number) {
  for (let i = start; i <= end; i++) yield i;
}

export function* cyclicRange(start: number, length: number) {
  for (let i = 0; i < length; i++) yield cyclic(start + i, length);
}

export function* cyclicPairs(length: number): Generator<[number, number]> {
  for (let i = 0; i < length; i++) yield [i, cyclic(i + 1, length)];
}
