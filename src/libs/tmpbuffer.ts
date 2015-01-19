
export class TempByteArray {

  private buffer:Uint8Array;
  private size:number = 0;

  constructor() {
    this.recreate(1);
  }

  public recreate(size:number):Uint8Array {
    if (size > this.size) {
      this.buffer = new Uint8Array(size);
    }
    for (var i = 0; i < this.size; i++)
      this.buffer[i] = 0;
    return this.buffer;
  }

  public get():Uint8Array {
    return this.buffer;
  }
}