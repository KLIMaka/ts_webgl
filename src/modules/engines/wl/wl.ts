import D = require('../../../libs/dataviewstream');
import B = require('../../bitreader');
import U = require('./utils');

var MSG_UNCOMPRESSED = 'MSG_UNCOMPRESSED';
var MSG_COMPRESSED = 'MSG_COMPRESSED';
var MSG_CPA_ANIMATION = 'MSG_CPA_ANIMATION';
 
class MsqHeader {
  constructor(
    public type:String,
    public disk:number,
    public size:number) {}
}

function readMsgHeader(r:D.DataViewStream):MsqHeader {
  var sign = D.atomic_array(D.ubyte, 4).read(r);
  if (r.eoi())
    return null;
  if (sign[0] == 0x6d && sign[1] == 0x73 && sign[2] == 0x71 && (sign[3] == 30 || sign[3] == 31)) {
    return new MsqHeader(MSG_UNCOMPRESSED, sign[3]-30, 0);
  }

  var size = sign[0] | (sign[1] << 8) | (sign[2] << 16) | (sign[3] << 24);
  sign = D.atomic_array(D.ubyte, 4).read(r);
  if (r.eoi())
    return null;
  if (sign[0] == 0x6d && sign[1] == 0x73 && sign[2] == 0x71 && (sign[3] == 0 || sign[3] == 1)) {
    return new MsqHeader(MSG_COMPRESSED, sign[3], size);
  }

  if (sign[0] == 0x08 && sign[1] == 0x67 && sign[2] == 0x01 && sign[3] == 0x00) {
    return new MsqHeader(MSG_CPA_ANIMATION, sign[3], size);
  }

  throw new Error('Unable to read MSQ header from stream');
}

function readPicsAnimation(r:D.DataViewStream, width:number) {
  var header = readMsgHeader(r);
  if (header == null)
    return null;
  if (header.type != MSG_COMPRESSED)
    throw new Error('Expected base frame block of PICS stream to be compressed');

  var height = header.size *2 / width;
  var huffmanStream = U.huffmanStream(r);
  var baseFrame = new Pic(huffmanStream, width, height);

  header = readMsgHeader(r);
  if (header == null)
    throw new Error('Unexpected end of stream while reading PICS animation block');
  if (header.type != MSG_COMPRESSED)
    throw new Error('Expected animation block of PICS stream to be compressed');

  huffmanStream = U.huffmanStream(r);

  var headerSize = huffmanStream.readWord();
  var instructions = huffmanStream.readData(headerSize);
  var dataSize = huffmanStream.readWord();
  
  var address = huffmanStream.readWord();
  if (address == 0xffff)
    return null;
  var bytes = ((address >> 12) & 0xf) + 1;
  address = address & 0xfff;
  var size = 2;
  var offset = address;
  var diff = huffmanStream.readData(bytes);


}

