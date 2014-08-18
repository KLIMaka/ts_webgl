///<reference path='defs/node.d.ts' />

import fs = require('fs');
import RFF = require('./modules/engines/build/rff');

function toArrayBuffer(buffer) {
  return new Uint8Array(buffer).buffer;
}

var ab = toArrayBuffer(fs.readFileSync('./resources/engines/blood/blood.rff'));
var file = RFF.create(ab);
fs.writeFile('E3M1.MAP', new Buffer(file.get('MAPE3M1')));