import D = require('../../../libs/dataviewstream');
import GM = require('./gamemap');
import U = require('./utils');

var fa0 = [
  {'m' : 1},
  {'s' : 2},
  {'q' : 3},
  {'0' : 4},
];
var fa1 = [
  {'m' : 1},
  {'s' : 2},
  {'q' : 3},
  {'1' : 4},
];

function search(r:D.DataViewStream, disk:string):number {
  var fa = disk == '0' ? fa0 : fa1;
  var state = 0;
  var length = 0;
  while(!r.eoi() && state != 4) {
    var b = r.readByteString(1);
    var state = fa[state][b] | 0;
    length++;
  }
  return length;
}


function readMsqBlocks(r:D.DataViewStream):number[][] {
  var sign = r.readByteString(4);
  if (sign != 'msq0' && sign != 'msq1')
    throw new Error('No msq header found in file');
  var disk = sign[3];
  var blocks = new Array<number[]>();
  var start = 0;
  var end = 4;

  while(true) {
    end += search(r, disk)
    if (!r.eoi()) {
      blocks.push([start, end-4-start]);
      start = end - 4;
    } else {
      break;
    }
  }
  blocks.push([start, end-start]);
  return blocks;
}

var TYPE_SAVEGAME = 'TYPE_SAVEGAME';
var TYPE_SHOPLIST = 'TYPE_SHOPLIST';
var TYPE_MAP = 'TYPE_MAP';

function isSaveGame(bytes:number[]):boolean {
  var seen = {};
  for (var i = 0; i < 8; i++) {
    var b = bytes[i];
    if (b > 7) return false;
    if (b != 0 && seen[b] == 1) return false;
    seen[b] = 1;
  }
  return true;
}

function isShopItems(bytes:number[]):boolean {
  if (bytes[0] == 0x60 && bytes[1] == 0x60 && bytes[2] == 0x60) 
    return true;
  return false;
}

function getType(r:D.DataViewStream, size:number) {
  var sign = r.readByteString(4);
  if (sign != 'msq0' && sign != 'msq1')
    throw new Error('No msq header found in file');
  var xorStream = U.rotatingXorStream(r);
  var bytes = new Array<number>(9);
  for (var i = 0; i < 9; i++)
    bytes[i] = xorStream.read();

  if (size == 4614 && isSaveGame(bytes)) {
    return TYPE_SAVEGAME;
  } else if (size == 766 && isShopItems(bytes)) {
    return TYPE_SHOPLIST;
  } else {
    return TYPE_MAP;
  }

}

export class Game {
  public maps:GM.GameMap[] = [];

  constructor(file:ArrayBuffer) {
    var r = new D.DataViewStream(file, true);
    var blocks = readMsqBlocks(r);
    for (var i = 0; i < blocks.length; i++) {
      var [start, size] = blocks[i];
      r.setOffset(start);
      var type = getType(r, size);
      r.setOffset(start);

      switch (type) {
        case TYPE_SAVEGAME:
          break;
        case TYPE_SHOPLIST:
          break;
        case TYPE_MAP:
          this.maps.push(new GM.GameMap(r, size));
          break;
      }
    }
  }
}

export function create(file:ArrayBuffer) {
  return new Game(file);
}