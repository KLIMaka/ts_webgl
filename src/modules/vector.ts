
export class IndexedVector<T> {
  private pointer = 0;
  private array: T[] = [];
  private index = new Map<T, number>();

  public get(i: number) {
    return this.array[i];
  }

  public push(value: T) {
    this.index.set(value, this.pointer);
    this.array[this.pointer++] = value;
  }

  public clear(): IndexedVector<T> {
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

export class Vector<T> {
  private pointer = 0;
  private array: T[];

  constructor(size: number = 10) {
    this.array = new Array<T>(size);
  }

  public get(i: number) {
    return this.array[i];
  }

  public push(value: T) {
    this.array[this.pointer++] = value;
  }

  public clear(): Vector<T> {
    this.pointer = 0;
    return this;
  }

  public length() {
    return this.pointer;
  }
}