
import L = require('../modules/list');

export class Pool<T> {

  private pool:Array<T>;
  private maxsize:number;
  private allocator:()=>T;
  private holes:L.List<number> = new L.List<number>();

  constructor(maxsize:number, allocator:()=>T) {
    this.maxsize = maxsize;
    this.pool = new Array<T>(0);
    this.allocator = allocator;
  }

  get():T {
    if (!this.holes.isEmpty()) {
      return this.pool[this.holes.pop()];
    }
    if (this.pool.length == this.maxsize)
      throw new Error("Pool overflow");
    this.pool.push(this.allocator());
    return this.pool[this.pool.length-1];
  }

  ret(...vals:T[]) {
    for (var i in vals){
      var val = vals[i];
      var idx = this.pool.indexOf(val);
      if (idx == -1)
        throw new Error('Object not from pool');
      this.holes.insertAfter(idx);
    }
  }
}