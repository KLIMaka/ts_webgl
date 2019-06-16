import { Sector, Wall, Sprite, Board } from "./structs";

export class SectorExtra {

}

export class BloodSector extends Sector {
  public extraData:SectorExtra;
}

export class WallExtra {

}

export class BloodWall extends Wall {
  public extraData:WallExtra;
}

export class SpriteExtra {
  public data1:number;
  public data2:number;
  public data3:number;
}

export class BloodSprite extends Sprite {
public extraData:SpriteExtra;
}

export class BloodBoard extends Board {
}