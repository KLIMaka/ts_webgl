import D = require('../../../libs/stream');

export class ActionClassMap {
  private actionClasses: number[];

  constructor(r: D.Stream, private mapSize: number) {
    this.mapSize = mapSize;
    this.actionClasses = new Array<number>(mapSize * mapSize);
    for (var i = 0; i < mapSize * mapSize; i += 2) {
      var b = r.readUByte();
      this.actionClasses[i] = (b >> 4) & 0x0f;
      this.actionClasses[i + 1] = b & 0x0f;
    }
  }

  public get(x: number, y: number): number {
    return this.actionClasses[y * this.mapSize + y];
  }
}

export class ActionMap {
  private actions: number[];

  constructor(r: D.Stream, private mapSize: number) {
    this.mapSize = mapSize;
    this.actions = new Array<number>(mapSize * mapSize);
    for (var i = 0; i < mapSize * mapSize; i++)
      this.actions[i] = r.readUByte();
  }

  public get(x: number, y: number): number {
    return this.actions[y * this.mapSize + y];
  }
}