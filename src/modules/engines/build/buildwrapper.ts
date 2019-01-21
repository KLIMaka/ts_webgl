import BS = require('./structs');
import U = require('./utils');
import GLU = require('../../../libs_js/glutess');
import DS = require('../../drawstruct');
import ITER = require('../../../libs/iterator');

export class Marked {
	private marker:number = -1;

	public mark(m:number):void { this.marker = m;	}
	public match(m:number):boolean { return this.marker == m }
}

function createMarkedIterator<T extends Marked>(list:T[], m:number):ITER.Iterator<T> {
	return ITER.filtered(ITER.list(list), (v:T) => v.match(m));
}

export class SpriteWrapper extends Marked {
	constructor(public ref:BS.Sprite) {super();}
}

export class SectorWrapper extends Marked {
	constructor(public ref:BS.Sector) {super();}
}

export class WallWrapper extends Marked {
	constructor(public ref:BS.Wall, public sector:SectorWrapper) {super();}
}

export class BoardWrapper {
	public sprites:SpriteWrapper[] = [];
	public walls:WallWrapper[] = [];
	public sectors:SectorWrapper[] = [];
	public sector2sprites:{[index:number]: SpriteWrapper[];} = {};

	constructor(private board:BS.Board) {
		for (var s = 0; s < board.numsectors; s++) {
			var sec = board.sectors[s];
			var secw = new SectorWrapper(sec);
			this.sectors.push(secw);
			for (var w = 0; w < sec.wallnum; w++) {
				var wallidx = sec.wallptr + w;
				var wall = board.walls[wallidx];
				var wallw = new WallWrapper(wall, secw);
				this.walls[wallidx] = wallw;
			}
		}

		for (var s = 0; s < board.numsprites; s++) {
			var spr = board.sprites[s];
			var sprw = new SpriteWrapper(spr);
			this.sprites.push(sprw);
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
        if (wall != undefined && this.wallVisible(wall, ms))
          wall.mark(m);
      }

      var nextsector = wall.ref.nextsector;
      if (nextsector == -1) continue;
      if (pvs.indexOf(nextsector) == -1)
        pvs.push(nextsector);
    }

    var sprites = this.sector2sprites[cursecnum];
    if (sprites != undefined) {
      for (var s = 0; s < sprites.length; s++) {
        sprites[s].mark(m);
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
}

function wallIterator(board:BS.Board, sec:number):ITER.Iterator<BS.Wall> {
	var sector = board.sectors[sec];
	var w = 0;
	return () => {
		if (w < sector.wallnum) {
			return board.walls[sector.wallptr + w++]
		}
		return null;
	}
}

function triangulate(board:BS.Board, sec:BS.Sector) {
  var contour = [];
  var contours = [];
  var fw = sec.wallptr;
  for (var w = 0; w < sec.wallnum; w++) {
    var wid = sec.wallptr + w;
    var wall = board.walls[wid];
    contour.push(wall.x, wall.y);
    if (wall.point2 == fw) {
      contours.push(contour);
      contour = [];
      fw = wid + 1;
    }
  }
  return GLU.tesselate(contours);
}

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

class BuildGl {
	private artProvider:ArtProvider;

	public renderSector(board:BoardWrapper, sec:SectorWrapper) {
  	var tris = triangulate(sec, board.walls);
    if (tris.length == 0)
    	return;

    var floortex = this.artProvider.get(sec.ref.floorpicnum);
    var ceilingtex = this.artProvider.get(sec.ref.ceilingpicnum);
    
	}
}