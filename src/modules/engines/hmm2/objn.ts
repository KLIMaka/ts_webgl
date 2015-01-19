
export function getAnimFrame(icn:string, start:number, ticket:number, quantity:number = 0):number {
    switch(icn) {

    case 'TELEPORT1':
    case 'TELEPORT2':
    case 'TELEPORT3': return start + ticket % 8;

    case 'FOUNTAIN':
    case 'TREASURE':  return start + ticket % 2;

    case 'TWNBBOAT':
    case 'TWNKBOAT':
    case 'TWNNBOAT':
    case 'TWNSBOAT':
    case 'TWNWBOAT':
    case 'TWNZBOAT':  return 1 + ticket % 9;

    case 'CMBTCAPB':
    case 'CMBTCAPK':
    case 'CMBTCAPN':
    case 'CMBTCAPS':
    case 'CMBTCAPW':
    case 'CMBTCAPZ':  return 1 + ticket % 10;

    case 'CMBTHROB':  return 1 + ticket % 18;
    case 'CMBTHROK':  return 1 + ticket % 19;
    case 'CMBTHRON':  return 1 + ticket % 19;
    case 'CMBTHROS':  return 1 + ticket % 16;
    case 'CMBTHROW':  return 1 + ticket % 16;
    case 'CMBTHROZ':  return 1 + ticket % 18;

    case 'HEROFL00':
    case 'HEROFL01':
    case 'HEROFL02':
    case 'HEROFL03':
    case 'HEROFL04':
    case 'HEROFL05':  return ticket % 5;

    case 'TWNBDOCK':
    case 'TWNKDOCK':
    case 'TWNNDOCK':
    case 'TWNSDOCK':
    case 'TWNWDOCK':
    case 'TWNZDOCK':

    case 'TWNBEXT0':
    case 'TWNKEXT0':
    case 'TWNNEXT0':
    case 'TWNSEXT0':
    case 'TWNWEXT0':
    case 'TWNZEXT0':

    case 'TWNBCAPT':
    case 'TWNBDW_3':
    case 'TWNBDW_4':
    case 'TWNBDW_5':
    case 'TWNBEXT1':
    case 'TWNBMOAT':
    case 'TWNBUP_3':
    case 'TWNBUP_4':
    case 'TWNKCSTL':
    case 'TWNKDW_0':
    case 'TWNKLTUR':
    case 'TWNKRTUR':
    case 'TWNKTHIE':
    case 'TWNKTVRN':
    case 'TWNNCSTL':
    case 'TWNNDW_2':
    case 'TWNNUP_2':
    case 'TWNSCAPT':
    case 'TWNSCSTL':
    case 'TWNSDW_0':
    case 'TWNSDW_1':
    case 'TWNSEXT1':
    case 'TWNSTHIE':
    case 'TWNSTVRN':
    case 'TWNSUP_1':
    case 'TWNSWEL2':
    case 'TWNWCAPT':
    case 'TWNWCSTL':
    case 'TWNWMOAT':
    case 'TWNZCSTL':
    case 'TWNZDW_0':
    case 'TWNZDW_2':
    case 'TWNZTHIE':
    case 'TWNZUP_2':  return 1 + ticket % 5;

    case 'TWNBCSTL':
    case 'TWNKDW_2':
    case 'TWNKUP_2':
    case 'TWNNDW_5':
    case 'TWNNWEL2':
    case 'TWNWDW_0':
    case 'TWNWWEL2':
    case 'TWNZTVRN':  return 1 + ticket % 6;

    case 'TWNKDW_4':
    case 'TWNKUP_4':  return 1 + ticket % 7;

    case 'TAVWIN':   return 2 + ticket % 20;

    case 'CMBTLOS1':  return 1 + ticket % 30;
    case 'CMBTLOS2':  return 1 + ticket % 29;
    case 'CMBTLOS3':  return 1 + ticket % 22;
    case 'CMBTFLE1':  return 1 + ticket % 43;
    case 'CMBTFLE2':  return 1 + ticket % 26;
    case 'CMBTFLE3':  return 1 + ticket % 25;
    case 'CMBTSURR':  return 1 + ticket % 20;

    case 'WINCMBT':   return 1 + ticket % 20;

    case 'MINIMON':   return start + 1 + ticket % 6;

    case 'TWNNMAGE':  return start + 1 + ticket % 5;

    case 'TWNBMAGE':  return 4 == start ? start + 1 + ticket % 8 : 0;

    case 'SHNGANIM':  return 1 + ticket % 39;
    
    case 'BTNSHNGL':  return start + ticket % 4;

    case 'OBJNHAUN':  return ticket % 15;

    case 'OBJNWATR':

        switch(start)
        {
        // buttle
        case 0x00:
            return start + (ticket % 11) + 1;

        // shadow
        case 0x0C:
        // chest
        case 0x13:
        // shadow
        case 0x26:
        // flotsam
        case 0x2D:
        // unkn
        case 0x37:
        // boat
        case 0x3E:
        // waves
        case 0x45:
        // seaweed
        case 0x4C:
        case 0x53:
        case 0x5A:
        case 0x61:
        case 0x68:
        // sailor-man
        case 0x6F:
        // shadow
        case 0xBC:
        // buoy
        case 0xC3:
        // broken ship (right)
        case 0xE2:
        case 0xE9:
        case 0xF1:
        case 0xF8:
            return start + (ticket % 6) + 1;

        // seagull on stones
        case 0x76:
        case 0x86:
        case 0x96:
        case 0xA6:
            return start + (ticket % 15) + 1;

        // whirlpool
        case 0xCA:
        case 0xCE:
        case 0xD2:
        case 0xD6:
        case 0xDA:
        case 0xDE:
            return start + (ticket % 3) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNWAT2':

        switch(start)
        {
        // sail broken ship (left)
        case 0x03:
        case 0x0C:
            return start + (ticket % 6) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNCRCK':

        switch(start)
        {
        // pool of oil
        case 0x50:
        case 0x5B:
        case 0x66:
        case 0x71:
        case 0x7C:
        case 0x89:
        case 0x94:
        case 0x9F:
        case 0xAA:
        // smoke from chimney
        case 0xBE:
        // shadow smoke
        case 0xCA:
            return start + (ticket % 10) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNDIRT':

        switch(start)
        {
        // mill
        case 0x99:
        case 0x9D:
        case 0xA1:
        case 0xA5:
        case 0xA9:
        case 0xAD:
        case 0xB1:
        case 0xB5:
        case 0xB9:
        case 0xBD:
            return start + (ticket % 3) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNDSRT':

        switch(start)
        {
        // campfire
        case 0x36:
        case 0x3D:
            return start + (ticket % 6) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNGRA2':

        switch(start)
        {
        // mill
        case 0x17:
        case 0x1B:
        case 0x1F:
        case 0x23:
        case 0x27:
        case 0x2B:
        case 0x2F:
        case 0x33:
        case 0x37:
        case 0x3B:
            return start + (ticket % 3) + 1;

        // smoke from chimney
        case 0x3F:
        case 0x46:
        case 0x4D:
        // archerhouse
        case 0x54:
        // smoke from chimney
        case 0x5D:
        case 0x64:
        // shadow smoke
        case 0x6B:
        // peasanthunt
        case 0x72:
            return start + (ticket % 6) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNLAV2':

        switch(start)
        {
        // middle volcano
        case 0x00:
        // shadow
        case 0x07:
        case 0x0E:
        // lava
        case 0x15:
            return start + (ticket % 6) + 1;

        // small volcano
        // shadow
        case 0x21:
        case 0x2C:
        // lava
        case 0x37:
        case 0x43:
            return start + (ticket % 10) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNLAV3':

        // big volcano
        switch(start)
        {
        // smoke
        case 0x00:
        case 0x0F:
        case 0x1E:
        case 0x2D:
        case 0x3C:
        case 0x4B:
        case 0x5A:
        case 0x69:
        case 0x87:
        case 0x96:
        case 0xA5:
        // shadow
        case 0x78:
        case 0xB4:
        case 0xC3:
        case 0xD2:
        case 0xE1:
            return start + (ticket % 14) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNLAVA':

        switch(start)
        {
        // shadow of lava
        case 0x4E:
        case 0x58:
        case 0x62:
            return start + (ticket % 9) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNMUL2':

        switch(start)
        {
        // lighthouse
        case 0x3D:
            return start + (ticket % 9) + 1;

        // alchemytower
        case 0x1B:
        // watermill
        case 0x53:
        case 0x5A:
        case 0x62:
        case 0x69:
        // fire in wagoncamp
        case 0x81:
        // smoke smithy (2 chimney)
        case 0xA6:
        // smoke smithy (1 chimney)
        case 0xAD:
        // shadow smoke
        case 0xB4:
            return start + (ticket % 6) + 1;

        // magic garden
        case 0xBE:
            return quantity ? start + (ticket % 6) + 1 : start + 7;

        default:
            return 0;
        }
        break;

    case 'OBJNMULT':

        switch(start)
        {
        // smoke
        case 0x05:
        // shadow
        case 0x0F:
        case 0x19:
            return start + (ticket % 9) + 1;

        // smoke
        case 0x24:
        // shadow
        case 0x2D:
            return start + (ticket % 8) + 1;

        // smoke
        case 0x5A:
        // shadow
        case 0x61:
        case 0x68:
        case 0x7C:
        // campfire
        case 0x83:
            return start + (ticket % 6) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNSNOW':

        switch(start)
        {
        // firecamp
        case 0x04:
        // alchemytower
        case 0x97:
        // watermill
        case 0xA2:
        case 0xA9:
        case 0xB1:
        case 0xB8:
            return start + (ticket % 6) + 1;

        // mill
        case 0x60:
        case 0x64:
        case 0x68:
        case 0x6C:
        case 0x70:
        case 0x74:
        case 0x78:
        case 0x7C:
        case 0x80:
        case 0x84:
            return start + (ticket % 3) + 1;

        default:
            return 0;
        }
        break;

    case 'OBJNSWMP':

        switch(start)
        {
        // shadow
        case 0x00:
        case 0x0E:
        case 0x2B:
        // smoke
        case 0x07:
        case 0x22:
        case 0x33:
        // light in window
        case 0x16:
        case 0x3A:
        case 0x43:
        case 0x4A:
            return start + (ticket % 6) + 1;
    
        default:
            return 0;
        }
        break;

    default: return 0;
    }
}

export function getIcn(id:number):string {

  switch (id) {
    // manual
    case 0x11:
        return 'TELEPORT1';
    case 0x12:
        return 'TELEPORT2';
    case 0x13:
        return 'TELEPORT3';
    case 0x14:
        return 'FOUNTAIN';
    case 0x15:
        return 'TREASURE';

    // artifact
    case 0x2C:
    case 0x2D:
    case 0x2E:
    case 0x2F:
        return 'OBJNARTI';

    // monster
    case 0x30:
    case 0x31:
    case 0x32:
    case 0x33:
        return 'MONS32';

    // castle flags
    case 0x38:
    case 0x39:
    case 0x3A:
    case 0x3B:
        return 'FLAG32';

    // heroes
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:
        return 'MINIHERO';

    // relief: snow
    case 0x58:
    case 0x59:
    case 0x5A:
    case 0x5B:
        return 'MTNSNOW';

    // relief: swamp
    case 0x5C:
    case 0x5D:
    case 0x5E:
    case 0x5F:
        return 'MTNSWMP';

    // relief: lava
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
        return 'MTNLAVA';

    // relief: desert
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:
        return 'MTNDSRT';

    // relief: dirt
    case 0x68:
    case 0x69:
    case 0x6A:
    case 0x6B:
        return 'MTNDIRT';

    // relief: others
    case 0x6C:
    case 0x6D:
    case 0x6E:
    case 0x6F:
        return 'MTNMULT';

    // mines
    case 0x74:
        return 'EXTRAOVR';

    // road
    case 0x78:
    case 0x79:
    case 0x7A:
    case 0x7B:
        return 'ROAD';

    // relief: crck
    case 0x7C:
    case 0x7D:
    case 0x7E:
    case 0x7F:
        return 'MTNCRCK';

    // relief: gras
    case 0x80:
    case 0x81:
    case 0x82:
    case 0x83:
        return 'MTNGRAS';

    // trees jungle
    case 0x84:
    case 0x85:
    case 0x86:
    case 0x87:
        return 'TREJNGL';

    // trees evil
    case 0x88:
    case 0x89:
    case 0x8A:
    case 0x8B:
        return 'TREEVIL';

    // castle and tower
    case 0x8C:
    case 0x8D:
    case 0x8E:
    case 0x8F:
        return 'OBJNTOWN';

    // castle lands
    case 0x90:
    case 0x91:
    case 0x92:
    case 0x93:
        return 'OBJNTWBA';

    // castle shadow
    case 0x94:
    case 0x95:
    case 0x96:
    case 0x97:
        return 'OBJNTWSH';

    // random castle
    case 0x98:
    case 0x99:
    case 0x9A:
    case 0x9B:
        return 'OBJNTWRD';

    // water object
    case 0xA0:
    case 0xA1:
    case 0xA2:
    case 0xA3:
        return 'OBJNWAT2';

    // object other
    case 0xA4:
    case 0xA5:
    case 0xA6:
    case 0xA7:
        return 'OBJNMUL2';

    // trees snow
    case 0xA8:
    case 0xA9:
    case 0xAA:
    case 0xAB:
        return 'TRESNOW';

    // trees trefir
    case 0xAC:
    case 0xAD:
    case 0xAE:
    case 0xAF:
        return 'TREFIR';

    // trees
    case 0xB0:
    case 0xB1:
    case 0xB2:
    case 0xB3:
        return 'TREFALL';

    // river
    case 0xB4:
    case 0xB5:
    case 0xB6:
    case 0xB7:
        return 'STREAM';

    // resource
    case 0xB8:
    case 0xB9:
    case 0xBA:
    case 0xBB:
        return 'OBJNRSRC';

    // gras object
    case 0xC0:
    case 0xC1:
    case 0xC2:
    case 0xC3:
        return 'OBJNGRA2';

    // trees tredeci
    case 0xC4:
    case 0xC5:
    case 0xC6:
    case 0xC7:
        return 'TREDECI';

    // sea object
    case 0xC8:
    case 0xC9:
    case 0xCA:
    case 0xCB:
        return 'OBJNWATR';

    // vegetation gras
    case 0xCC:
    case 0xCD:
    case 0xCE:
    case 0xCF:
        return 'OBJNGRAS';

    // object on snow
    case 0xD0:
    case 0xD1:
    case 0xD2:
    case 0xD3:
        return 'OBJNSNOW';

    // object on swamp
    case 0xD4:
    case 0xD5:
    case 0xD6:
    case 0xD7:
        return 'OBJNSWMP';

    // object on lava
    case 0xD8:
    case 0xD9:
    case 0xDA:
    case 0xDB:
        return 'OBJNLAVA';

    // object on desert
    case 0xDC:
    case 0xDD:
    case 0xDE:
    case 0xDF:
        return 'OBJNDSRT';

    // object on dirt
    case 0xE0:
    case 0xE1:
    case 0xE2:
    case 0xE3:
        return 'OBJNDIRT';

    // object on crck
    case 0xE4:
    case 0xE5:
    case 0xE6:
    case 0xE7:
        return 'OBJNCRCK';

    // object on lava
    case 0xE8:
    case 0xE9:
    case 0xEA:
    case 0xEB:
        return 'OBJNLAV3';

    // object on earth
    case 0xEC:
    case 0xED:
    case 0xEE:
    case 0xEF:
        return 'OBJNMULT';
        
    //  object on lava
    case 0xF0:
    case 0xF1:
    case 0xF2:
    case 0xF3:
        return 'OBJNLAV2';
  }
  return null;
}