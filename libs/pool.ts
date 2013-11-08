export class Pool<T> {

  private pool:Array<T>;
  private maxsize:number;
  private allocator:()=>T;
  private top:number = 0;

  constructor(maxsize:number, allocator:()=>T) {
    this.maxsize = maxsize;
    this.pool = new Array<T>(maxsize);
    this.allocator = allocator;
  }

  get():T {
    if (this.top == this.maxsize)
      throw new Error("Pool owerflow");
    if (this.pool[this.top] == undefined)
      this.pool[this.top] = this.allocator();
    return this.pool[this.top++];
  }

  ret(...vals:T[]) {
    if (this.top - vals.length < 0)
      throw new Error("Pool underflow");
    this.top -= vals.length;
  }
}