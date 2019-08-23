import AC = require('./actionclass');
import G = require('./gameclasses');
import U = require('./utils');
import D = require('../../../libs/stream');
import I = require('./infoclasses');
import S = require('./strings');

export class GameMap {

  public mapSize: number;
  private size: number;
  private tilemapOffset: number;

  public actionClassMap: AC.ActionClassMap;
  public actionMap: AC.ActionMap;
  public info: I.Info;
  public battleSettings: I.BattleSettings;
  public tileMap: I.TileMap;
  public strings: S.Strings;
  public npcs: G.NPCS;
  public monsters: G.Monsters;


  constructor(r: D.Stream, size: number) {
    var sign = r.readByteString(4);
    if (sign != 'msq0' && sign != 'msq1')
      throw new Error('No msq header found in file');

    var start = r.mark();
    var xorStream = U.rotatingXorStream(r);
    var bytes = new Uint8Array(6189);
    for (var i = 0; i < 6189; i++) {
      bytes[i] = xorStream.read();
    }

    var mapSize = this.getMapSize(bytes);
    var encSize = this.getEncryptionSize(bytes, mapSize);

    bytes = new Uint8Array(size - 6);
    r.setOffset(start);
    xorStream = U.rotatingXorStream(r);
    for (var i = 0; i < encSize; i++)
      bytes[i] = xorStream.read();
    for (var i = encSize; i < bytes.length; i++)
      bytes[i] = r.readUByte();

    var tilemapOffset = this.getTilemapOffset(bytes, mapSize);
    var stream = new D.Stream(bytes.buffer, true);
    this.mapSize = mapSize;
    this.size = size;
    this.tilemapOffset = tilemapOffset;
    this.read(stream);
  }

  private read(stream: D.Stream): void {
    this.actionClassMap = new AC.ActionClassMap(stream, this.mapSize);
    this.actionMap = new AC.ActionMap(stream, this.mapSize);
    var centralDirectory = I.readCentralDirectory(stream);
    stream.readUByte();
    this.info = I.readInfo(stream);
    this.battleSettings = new I.BattleSettings(stream);

    stream.setOffset(this.tilemapOffset);
    this.tileMap = new I.TileMap(stream);

    stream.setOffset(centralDirectory.stringsOffset);
    this.strings = new S.Strings(stream, this.tilemapOffset);

    stream.setOffset(centralDirectory.npcOffset);
    this.npcs = new G.NPCS(stream);

    var monstersOffset = centralDirectory.monsterDataOffset;
    if (monstersOffset != 0) {
      var quantity = (centralDirectory.stringsOffset - monstersOffset) / 8;
      stream.setOffset(centralDirectory.monsterNamesOffset);
      this.monsters = new G.Monsters(stream, quantity, monstersOffset);
    }
  }

  private getMapSize(bytes: Uint8Array): number {
    var is64 = false;
    var offset = 64 * 64 * 3 / 2;
    if ((offset + 44 < bytes.length) && (bytes[offset + 44] == 64 && bytes[offset + 6] == 0 && bytes[offset + 7] == 0)) {
      is64 = true;
    }

    var is32 = false;
    offset = 32 * 32 * 3 / 2;
    if ((offset + 44 < bytes.length && bytes[offset + 6] == 0 && bytes[offset + 7] == 0) && (bytes[offset + 44] == 32)) {
      is32 = true;
    }

    if (is32 == is64)
      throw new Error('Cannot determine map size');

    return is64 ? 64 : 32;
  }

  private getEncryptionSize(bytes: Uint8Array, mapSize: number): number {
    var offset = mapSize * mapSize * 3 / 2;
    return ((bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8));
  }

  private getTilemapOffset(bytes: Uint8Array, mapSize: number): number {
    var i = bytes.length - 9;
    while (i > 0) {
      if ((bytes[i] == 0) && (bytes[i + 1] == ((mapSize * mapSize) >> 8))
        && (bytes[i + 2] == 0) && (bytes[i + 3] == 0)
        && (bytes[i + 6] == 0) && (bytes[i + 7] == 0)) {
        return i;
      }
      i--;
    }
    throw new Error('Unable to find tiles offset');
  }
}