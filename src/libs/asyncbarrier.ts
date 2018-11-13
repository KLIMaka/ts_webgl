
export class AsyncBarrier {
  private results = {};
  private requests = 0;
  private isWaiting = false;
  private cb:(v:any)=>void;

  public callback(name:string) {
    var self = this;
    this.requests++;
    return (val) => {
      self.result(name, val);
    }
  }

  private result(name:string, value) {
    this.results[name] = value;
    this.requests--;
    if (this.requests == 0 && this.isWaiting)
      this.cb(this.results);
  }

  public wait(cb:(v:any)=>void) {
    this.cb = cb;
    if (this.requests == 0)
      this.cb(this.results);
    this.isWaiting = true;
  }
}

export function create():AsyncBarrier {
  return new AsyncBarrier();
}