import D = require('../../../libs/stream');

export class Skills {
  public skills: number[][] = new Array<number[]>();

  constructor(r: D.Stream) {
    for (var i = 0; i < 30; i++) {
      this.skills.push([r.readUByte(), r.readUByte()]);
    }
  }
}

export class Items {
  private items: number[][] = new Array<number[]>();

  constructor(r: D.Stream) {
    for (var i = 0; i < 30; i++) {
      var id = r.readUByte();
      var load = r.readUByte();
      if (id != 0)
        this.items.push([id, load]);
    }
  }
}

export class Char {
  public name: string;
  public str: number;
  public iq: number;
  public lck: number;
  public spd: number;
  public agi: number;
  public dex: number;
  public chr: number;
  public money: number;
  public gender: number;
  public natio: number;
  public ac: number;
  public maxCon: number;
  public con: number;
  public weapon: number;
  public skillPoints: number;
  public exp: number;
  public level: number;
  public armor: number;
  public lastCon: number;
  public afflictions: number;
  public isNpc: number;
  public unknown2A: number;
  public itemRefuse: number;
  public skillRefuse: number;
  public attribRefuse: number;
  public tradeRefuse: number;
  public unknown2F: number;
  public joinString: number;
  public willingness: number;
  public rank: string;
  public skills: Skills;
  public items: Items;

  constructor(r: D.Stream) {
    this.name = r.readByteString(14);
    this.str = r.readUByte();
    this.iq = r.readUByte();
    this.lck = r.readUByte();
    this.spd = r.readUByte();
    this.agi = r.readUByte();
    this.dex = r.readUByte();
    this.chr = r.readUByte();
    var tmp = r.readUInt();
    this.money = tmp & 0xffffff;
    this.gender = (tmp >> 16) & 0xff;
    this.natio = r.readUByte();
    this.ac = r.readUByte();
    this.maxCon = r.readUShort();
    this.con = r.readUShort();
    this.weapon = r.readUByte();
    this.skillPoints = r.readUByte();
    tmp = r.readUInt();
    this.exp = tmp & 0xffffff;
    this.level = (tmp >> 16) & 0xff;
    this.armor = r.readUByte();
    this.lastCon = r.readUShort();
    this.afflictions = r.readUByte();
    this.isNpc = r.readUByte();
    this.unknown2A = r.readUByte();
    this.itemRefuse = r.readUByte();
    this.skillRefuse = r.readUByte();
    this.attribRefuse = r.readUByte();
    this.tradeRefuse = r.readUByte();
    this.unknown2F = r.readUByte();
    this.joinString = r.readUByte();
    this.willingness = r.readUByte();
    this.rank = r.readByteString(25);
    r.skip(53);
    this.skills = new Skills(r);
    r.skip(1);
    this.items = new Items(r);
    r.skip(7);
  }
}

export class NPCS {
  public chars: Char[] = [];

  constructor(r: D.Stream) {
    var offset = r.mark();
    if (r.readUShort() != 0)
      return;

    offset += 2;
    var quantity = (r.readUShort() - offset) / 2;
    if (quantity < 1 || quantity > 255)
      return;

    offset += quantity * 2;
    for (var i = 1; i < quantity; i++) {
      var tmp = r.readUShort();
      if (tmp != (offset + i * 0x100))
        return
    }

    for (var i = 0; i < quantity; i++)
      this.chars.push(new Char(r));
  }
}

export class Monster {
  public name: string;
  public exp: number;
  public skill: number;
  public randomDamage: number;
  public maxGroupSize: number;
  public ac: number;
  public fixedDamage: number;
  public weaponType: number;
  public type: number;
  public picture: number;
}

var MonsterStruct = D.struct(Monster, [
  ["exp", D.ushort],
  ["skill", D.ubyte],
  ["randomDamage", D.ubyte],
  ["maxGroupSize,ac", D.bit_field([4, 4])],
  ["fixedDamage,weaponType", D.bit_field([4, 4])],
  ["type", D.ubyte],
  ["picture", D.ubyte]
]);

function readMonster(r: D.Stream, name: string): Monster {
  var mon = MonsterStruct.read(r);
  mon.name = name;
  return mon;
}

export class Monsters {
  public monsters: Monster[] = [];

  constructor(r: D.Stream, quantity: number, dataOffset: number) {
    var names: string[] = [];
    for (var i = 0; i < quantity; i++) {
      var name = '';
      var b = r.readUByte();
      while (b != 0) {
        name += String.fromCharCode(b);
        b = r.readUByte();
      }
      names.push(name);
    }

    r.setOffset(dataOffset);
    for (var i = 0; i < quantity; i++) {
      this.monsters.push(readMonster(r, names[i]));
    }
  }
}