import BS = require('./structs');
import U = require('./utils');
import GLU = require('../../../libs_js/glutess');
import DS = require('../../drawstruct');
import ITER = require('../../../libs/iterator');

export class Marked {
  private marker:number = -1;

  public mark(m:number):void { this.marker = m; }
  public match(m:number):boolean { return this.marker == m }
}

function createMarkedIterator<T extends Marked>(list:T[], m:number):ITER.Iterator<T> {
  return ITER.filtered(ITER.list(list), (v:T) => v.match(m));
}

var globalId = 1;
function genId():number {
  return globalId++;
}

export class SpriteWrapper extends Marked {
  constructor(public ref:BS.Sprite, public boardid:number, public id:number=genId()) {super();}
}

export class SectorWrapper extends Marked {
  constructor(public ref:BS.Sector, public boardid:number, public id:number=genId()) {super();}
}

export class WallWrapper extends Marked {
  constructor(public ref:BS.Wall, public sector:SectorWrapper, public boardid:number, public id:number=genId()) {super();}
}

export class BoardWrapper {
  public sprites:SpriteWrapper[] = [];
  public walls:WallWrapper[] = [];
  public sectors:SectorWrapper[] = [];
  public sector2sprites:{[index:number]: SpriteWrapper[];} = {};
  public id2object = {};

  constructor(public ref:BS.Board) {
    for (var s = 0; s < ref.numsectors; s++) {
      var sec = ref.sectors[s];
      var secw = new SectorWrapper(sec, s);
      this.sectors.push(secw);
      this.id2object[secw.id] = secw;
      for (var w = 0; w < sec.wallnum; w++) {
        var wallidx = sec.wallptr + w;
        var wall = ref.walls[wallidx];
        var wallw = new WallWrapper(wall, secw, wallidx);
        this.walls[wallidx] = wallw;
        this.id2object[wallw.id] = wallw;
      }
    }

    for (var s = 0; s < ref.numsprites; s++) {
      var spr = ref.sprites[s];
      var sprw = new SpriteWrapper(spr, s);
      this.sprites.push(sprw);
      this.id2object[sprw.id] = sprw;
      var sprsec = spr.sectnum;
      if (sprsec != -1) {
        var sprites = this.sector2sprites[sprsec];
        if (sprites == undefined) {
          sprites = [];
          this.sector2sprites[sprsec] = sprites;
        }
        sprites.push(sprw);
      }
    }
  }

  public wallVisible(wall:WallWrapper, ms:U.MoveStruct) {
    var wall2 = this.walls[wall.ref.point2];
    return U.wallVisible(wall.ref, wall2.ref, ms);
  }

  public markVisible(ms:U.MoveStruct, m:number) {
    var pvs = [ms.sec];
    var sectors = this.sectors;
    var walls = this.walls;
    for (var i = 0; i < pvs.length; i++) {
      var cursecnum = pvs[i];
      var sec = sectors[cursecnum];

      if (sec != undefined) {
        sec.mark(m);
      }

      for (var w = 0; w < sec.ref.wallnum; w++) {
        var wallidx = sec.ref.wallptr + w;
        var wall = walls[wallidx];
        if (wall != undefined && this.wallVisible(wall, ms)) {
          wall.mark(m);
          var nextsector = wall.ref.nextsector;
          if (nextsector == -1) continue;
          if (pvs.indexOf(nextsector) == -1)
            pvs.push(nextsector);
        }
      }

      var sprites = this.sector2sprites[cursecnum];
      if (sprites != undefined) {
        sprites.map((s) => s.mark(m));
      }
    }
  }

  public markedSectors(m:number):ITER.Iterator<SectorWrapper> {
    return createMarkedIterator<SectorWrapper>(this.sectors, m);
  }

  public markedWalls(m:number):ITER.Iterator<WallWrapper> {
    return createMarkedIterator<WallWrapper>(this.walls, m);
  }

  public markedSprites(m:number):ITER.Iterator<SpriteWrapper> {
    return createMarkedIterator<SpriteWrapper>(this.sprites, m);
  }

  public allSectors():ITER.Iterator<SectorWrapper> {
    return ITER.list(this.sectors);
  }

  public allWalls():ITER.Iterator<WallWrapper> {
    return ITER.list(this.walls);
  }

  public allSprites():ITER.Iterator<SpriteWrapper> {
    return ITER.list(this.sprites);
  }
}