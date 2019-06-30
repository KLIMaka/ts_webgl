
export class NumberVector {
  private pointer = 0;
  private array: Uint32Array;

  constructor(size: number = 10) {
    this.array = new Uint32Array(size);
  }

  public get(i: number) {
    return this.array[i];
  }

  public push(value: number) {
    if (this.array.length <= this.pointer) {
      let narray = new Uint32Array(this.array.length * 2);
      narray.set(this.array);
      this.array = narray;
    }
    this.array[this.pointer++] = value;
  }

  public clear(): NumberVector {
    this.pointer = 0;
    return this;
  }

  public length() {
    return this.pointer;
  }

  public indexOf(value: number) {
    for (let i = 0; i < this.pointer; i++)
      if (this.array[i] == value)
        return i;
    return -1;
  }
}

export class ObjectVector<T> {
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

  public clear() {
    this.pointer = 0;
  }

  public length() {
    return this.pointer;
  }
}