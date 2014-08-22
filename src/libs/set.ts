
export class Set<T> {

  private table:any = {};

  constructor(array:T[]=[]) {
    for (var i in array) 
      this.add(array[i]);
  }

  public add(val:T):void {
    this.table[val] = 1;
  }

  public remove(val:T):void {
    this.table[val] = 0;
  }

  public has(val:T):boolean {
    return this.table[val] == 1;
  }

  public values():T[] {
    var arr:T[] = [];
    for (var i in this.table)
      if (this.table[i] == 1)
        arr.push(i);
    return arr;
  }
}

export function create<T>(array:T[]=[]) {
  return new Set<T>(array);
}