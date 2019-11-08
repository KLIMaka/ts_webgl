
export interface Iterator<T> {
  get(): T;
  eq(iter: Iterator<T>): boolean;
}

export interface ForwardIterator {
  next(): void;
}

export interface BackIterator {
  back(): void;
}

export interface WriteIterator<T> {
  set(value: T): void;
}

export class ArrayIterator<T> implements Iterator<T>, ForwardIterator, BackIterator, WriteIterator<T> {
  constructor(private array: Array<T>, private idx: number) { }
  get(): T { return this.array[this.idx]; }
  set(value: T): void { this.array[this.idx] = value; }
  next(): void { this.idx++; }
  back(): void { this.idx--; }
  eq(iter: ArrayIterator<T>): boolean { return this.array === iter.array && this.idx === iter.idx; }
}

export function arrayStart<T>(arr: Array<T>) {
  return new ArrayIterator<T>(arr, 0);
}

export function arrayEnd<T>(arr: Array<T>) {
  return new ArrayIterator<T>(arr, arr.length);
}

export class SeqIterrator implements Iterator<number>, ForwardIterator, BackIterator {
  constructor(private idx: number = 0) { }
  get(): number { return this.idx; }
  next(): void { this.idx++; }
  back(): void { this.idx--; }
  eq(iter: SeqIterrator) { return this.idx === iter.idx; }
}

export function seq(idx: number) {
  return new SeqIterrator(idx);
}