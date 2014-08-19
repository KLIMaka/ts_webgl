///<reference path='defs/node.d.ts' />

import fs = require('fs');
import RFF = require('./modules/engines/build/rff');

function toArrayBuffer(buffer) {
  return new Uint8Array(buffer).buffer;
}

var fname = process.argv[2];
if (!fs.existsSync(fname))
  throw new Error('File does not exists: ' + fname);

var file = RFF.create(toArrayBuffer(fs.readFileSync(fname)));
var cmd = process.argv[3];

switch (cmd)
{
  case 'extract': {
    var ifile = process.argv[4];
    var ofile = process.argv[5];
    fs.writeFile(ofile, new Buffer(file.get(ifile)));
    break;
  }
  case 'list': {
    file.fat.forEach((r) => console.log(r.filename + "\t" + r.size));
    break;
  }
  default: {
    throw new Error('Unsupported command ' + cmd);
  }
}