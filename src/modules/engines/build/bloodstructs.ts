import { Sector, Wall, Sprite, Board } from "./structs";

export class SectorExtra {
  public unk: number;
}

export class BloodSector extends Sector {
  public extraData: SectorExtra;
}

export class WallExtra {
  public unk: number;
}

export class BloodWall extends Wall {
  public extraData: WallExtra;
}

export class SpriteExtra {
  public unk: number;
  public data1: number;
  public data2: number;
  public data3: number;
}

export class BloodSprite extends Sprite {
  public extraData: SpriteExtra;
}

export class BloodBoard extends Board {
  public sectors: BloodSector[];
  public walls: BloodWall[];
  public sprites: BloodSprite[];
}