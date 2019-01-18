import BS = require('./structs');
import U = require('./utils');
import GLU = require('../../../libs_js/glutess');
import DS = require('../../drawstruct');

export class Marked {
	private marker:number = -1;

	public mark(m:number):void { this.marker = m;	}
	public match(m:number):boolean { return this.marker == m }
}

export interface Iterator<T> {
	next():T;
}

export class ListIterator<T> implements Iterator<T> {
	private i = 0;
	constructor(private list:T[]) {}
	public next():T {
		if(this.i < this.list.length)
			return this.list[this.i++];
		return null;
	}
}

export class MarkedIterator<T extends Marked> implements Iterator<T> {
	private i = 0;
	constructor(private list:T[], private m:number) {}
	public next():T {
		while(this.i < this.list.length) {
			if (this.list[this.i].match(this.m))
				return this.list[this.i++];
			this.i++;
		}
		return null;
	}
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

  public markedSectors(m:number):Iterator<SectorWrapper> {
  	return new MarkedIterator<SectorWrapper>(this.sectors, m);
  }

  public markedWalls(m:number):Iterator<WallWrapper> {
  	return new MarkedIterator<WallWrapper>(this.walls, m);
  }

  public markedSprites(m:number):Iterator<SpriteWrapper> {
  	return new MarkedIterator<SpriteWrapper>(this.sprites, m);
  }
}

function triangulate(sector:SectorWrapper, walls:WallWrapper[]):number[][] {
  var chains = [];
  for (var i = 0; i < sector.ref.wallnum; i++) {
    var firstwallIdx = i + sector.ref.wallptr;
    var ws = [firstwallIdx];
    var wall = walls[firstwallIdx];
    while (wall.ref.point2 != firstwallIdx){
      ws.push(wall.ref.point2);
      wall = walls[wall.ref.point2];
      i++;
    }
    chains.push(ws);
  }

  var contours = [];
  for (var i = 0; i < chains.length; i++) {
    var contour = [];
    var chain = chains[i];
    for (var j = 0; j < chain.length; j++) {
      var wall = walls[chain[j]];
      contour.push(wall.ref.x, wall.ref.y);
    }
    contours.push(contour);
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