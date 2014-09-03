
export function getIcn(id:number):string {

  switch (id) {
    // manual
    case 0x11:
        return 'TELEPORT1.ICN';
    case 0x12:
        return 'TELEPORT2.ICN';
    case 0x13:
        return 'TELEPORT3.ICN';
    case 0x14:
        return 'FOUNTAIN.ICN';
    case 0x15:
        return 'TREASURE.ICN';

    // artifact
    case 0x2C:
    case 0x2D:
    case 0x2E:
    case 0x2F:
        return 'OBJNARTI.ICN';

    // monster
    case 0x30:
    case 0x31:
    case 0x32:
    case 0x33:
        return 'MONS32.ICN';

    // castle flags
    case 0x38:
    case 0x39:
    case 0x3A:
    case 0x3B:
        return 'FLAG32.ICN';

    // heroes
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:
        return 'MINIHERO.ICN';

    // relief: snow
    case 0x58:
    case 0x59:
    case 0x5A:
    case 0x5B:
        return 'MTNSNOW.ICN';

    // relief: swamp
    case 0x5C:
    case 0x5D:
    case 0x5E:
    case 0x5F:
        return 'MTNSWMP.ICN';

    // relief: lava
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
        return 'MTNLAVA.ICN';

    // relief: desert
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:
        return 'MTNDSRT.ICN';

    // relief: dirt
    case 0x68:
    case 0x69:
    case 0x6A:
    case 0x6B:
        return 'MTNDIRT.ICN';

    // relief: others
    case 0x6C:
    case 0x6D:
    case 0x6E:
    case 0x6F:
        return 'MTNMULT.ICN';

    // mines
    case 0x74:
        return 'EXTRAOVR.ICN';

    // road
    case 0x78:
    case 0x79:
    case 0x7A:
    case 0x7B:
        return 'ROAD.ICN';

    // relief: crck
    case 0x7C:
    case 0x7D:
    case 0x7E:
    case 0x7F:
        return 'MTNCRCK.ICN';

    // relief: gras
    case 0x80:
    case 0x81:
    case 0x82:
    case 0x83:
        return 'MTNGRAS.ICN';

    // trees jungle
    case 0x84:
    case 0x85:
    case 0x86:
    case 0x87:
        return 'TREJNGL.ICN';

    // trees evil
    case 0x88:
    case 0x89:
    case 0x8A:
    case 0x8B:
        return 'TREEVIL.ICN';

    // castle and tower
    case 0x8C:
    case 0x8D:
    case 0x8E:
    case 0x8F:
        return 'OBJNTOWN.ICN';

    // castle lands
    case 0x90:
    case 0x91:
    case 0x92:
    case 0x93:
        return 'OBJNTWBA.ICN';

    // castle shadow
    case 0x94:
    case 0x95:
    case 0x96:
    case 0x97:
        return 'OBJNTWSH.ICN';

    // random castle
    case 0x98:
    case 0x99:
    case 0x9A:
    case 0x9B:
        return 'OBJNTWRD.ICN';

    // water object
    case 0xA0:
    case 0xA1:
    case 0xA2:
    case 0xA3:
        return 'OBJNWAT2.ICN';

    // object other
    case 0xA4:
    case 0xA5:
    case 0xA6:
    case 0xA7:
        return 'OBJNMUL2.ICN';

    // trees snow
    case 0xA8:
    case 0xA9:
    case 0xAA:
    case 0xAB:
        return 'TRESNOW.ICN';

    // trees trefir
    case 0xAC:
    case 0xAD:
    case 0xAE:
    case 0xAF:
        return 'TREFIR.ICN';

    // trees
    case 0xB0:
    case 0xB1:
    case 0xB2:
    case 0xB3:
        return 'TREFALL.ICN';

    // river
    case 0xB4:
    case 0xB5:
    case 0xB6:
    case 0xB7:
        return 'STREAM.ICN';

    // resource
    case 0xB8:
    case 0xB9:
    case 0xBA:
    case 0xBB:
        return 'OBJNRSRC.ICN';

    // gras object
    case 0xC0:
    case 0xC1:
    case 0xC2:
    case 0xC3:
        return 'OBJNGRA2.ICN';

    // trees tredeci
    case 0xC4:
    case 0xC5:
    case 0xC6:
    case 0xC7:
        return 'TREDECI.ICN';

    // sea object
    case 0xC8:
    case 0xC9:
    case 0xCA:
    case 0xCB:
        return 'OBJNWATR.ICN';

    // vegetation gras
    case 0xCC:
    case 0xCD:
    case 0xCE:
    case 0xCF:
        return 'OBJNGRAS.ICN';

    // object on snow
    case 0xD0:
    case 0xD1:
    case 0xD2:
    case 0xD3:
        return 'OBJNSNOW.ICN';

    // object on swamp
    case 0xD4:
    case 0xD5:
    case 0xD6:
    case 0xD7:
        return 'OBJNSWMP.ICN';

    // object on lava
    case 0xD8:
    case 0xD9:
    case 0xDA:
    case 0xDB:
        return 'OBJNLAVA.ICN';

    // object on desert
    case 0xDC:
    case 0xDD:
    case 0xDE:
    case 0xDF:
        return 'OBJNDSRT.ICN';

    // object on dirt
    case 0xE0:
    case 0xE1:
    case 0xE2:
    case 0xE3:
        return 'OBJNDIRT.ICN';

    // object on crck
    case 0xE4:
    case 0xE5:
    case 0xE6:
    case 0xE7:
        return 'OBJNCRCK.ICN';

    // object on lava
    case 0xE8:
    case 0xE9:
    case 0xEA:
    case 0xEB:
        return 'OBJNLAV3.ICN';

    // object on earth
    case 0xEC:
    case 0xED:
    case 0xEE:
    case 0xEF:
        return 'OBJNMULT.ICN';
        
    //  object on lava
    case 0xF0:
    case 0xF1:
    case 0xF2:
    case 0xF3:
        return 'OBJNLAV2.ICN';
  }
  return null;
}