import List = require('./list');

class Place {
  constructor(public offset:number, public size:number) {}
}

export class Bag {

  public put(offset:number, size:number):void {
    
  }

  public get(size:number):number {

  }
}

export function create() {
  return new Bag();
}