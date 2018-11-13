
export class Heap {

  private last = 0;

  constructor(private size:number) {
  }

  public allocate(size:number):number {
    if (this.last + size >= this.size)
      throw new Error('Heap overflow');
    var ret = this.last;
    this.last += size;
    return ret;
  }

  public remove(offset:number, size:number) {
    if (offset+size > this.last)
      throw new Error('Heap underflow');
    if (offset+size == this.last)
      this.last -= size;
  }
}


export function create(size:number):Heap {
  return new Heap(size);
}