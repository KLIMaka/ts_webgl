import * as BAG from '../../../../libs/bag';
import * as MB from '../../../meshbuilder';

var pos:Float32Array;
var posBuf:MB.VertexBufferDynamic;
var norm:Float32Array;
var normBuf:MB.VertexBufferDynamic;
var idxs:Uint16Array;
var idxBuf:MB.DynamicIndexBuffer;

var vtxBag:BAG.BagController;
var idxBag:BAG.BagController;

export function init(gl:WebGLRenderingContext, vCount:number, iCount:number) {
  pos = new Float32Array(vCount*3);
  posBuf = MB.wrap(gl, pos, 3);

  norm = new Float32Array(vCount*2);
  normBuf = MB.wrap(gl, norm, 2);

  vtxBag = BAG.createController(vCount, (place:BAG.Place, noffset:number) => {
    pos.set(pos.subarray(place.offset*3, place.offset*3+place.size*3), noffset*3);
    norm.set(norm.subarray(place.offset*2, place.offset*2+place.size*2), noffset*2);
    var idxPlce = <BAG.Place> place.data;
    var offdiff = noffset - place.offset;
    for(var i = 0; i < idxPlce.size; i++) {
      idxs[idxPlce.offset+i] += offdiff;
    }
  });

  idxs = new Uint16Array(iCount);
  idxBuf = MB.wrapIndexBuffer(gl, idxs);

  idxBag = BAG.createController(iCount, (place:BAG.Place, noffset:number) => {
    idxs.set(idxs.subarray(place.offset, place.offset+place.size), noffset);
  });
}

export function getPosBuffer():MB.VertexBufferDynamic {
  return posBuf;
}

export function getNormBuffer():MB.VertexBufferDynamic {
  return normBuf;
}

export function getIdxBuffer():MB.DynamicIndexBuffer {
  return idxBuf;
}

export function resetBufferUpdates():number {
  var n = bufferUpdates;
  bufferUpdates = 0;
  return n;
}


var vtxRegions = [];
var nrmRegions = [];
var idxRegions = [];
var bufferUpdates = 0;

function updateBuffer(gl:WebGLRenderingContext, buffer:any, regions:number[][]):boolean {
  if (regions.length == 0)
    return false;
  for (var i = 0; i < regions.length; i++) {
    var region = regions[i];
    while (i+1 < regions.length && regions[i+1][0] == region[0]+region[1]) {
      region[1] += regions[++i][1];
    }
    buffer.updateRegion(gl, region[0], region[1]);
    bufferUpdates++;
  }
  return true;
}

export function update(gl:WebGLRenderingContext) {
  if (updateBuffer(gl, posBuf, vtxRegions)) vtxRegions = [];
  if (updateBuffer(gl, normBuf, nrmRegions)) nrmRegions = [];
  if (updateBuffer(gl, idxBuf, idxRegions)) idxRegions = [];
}

export function allocate(vtxSize:number, idxSize:number, idxLineSize:number):BAG.Place {
  var vtx = vtxBag.get(vtxSize);
  var idx = idxBag.get(idxSize);
  var line = idxBag.get(idxLineSize);
  vtx.data = [idx, line];
  return vtx;
}

export function remove(place:BAG.Place) {
  idxBag.put(place.data[0]);
  idxBag.put(place.data[1]);
  vtxBag.put(place);
}

export function writePos(place:BAG.Place, off:number, x:number, y:number, z:number):number {
  var o = place.offset+off;
  pos[o*3] = x;
  pos[o*3+1] = y;
  pos[o*3+2] = z;
  vtxRegions.push([o, 1]);
  return ++off;
}

export function writeNormal(place:BAG.Place, off:number, x:number, y:number):number {
  var o = place.offset+off;
  norm[o*2] = x;
  norm[o*2+1] = y;
  nrmRegions.push([o, 1]);
  return ++off;
}

export function writeTriangle(place:BAG.Place, off:number, a:number, b:number, c:number):number {
  var vtxoff = place.offset;
  var o = (<BAG.Place>place.data[0]).offset+off;
  idxs[o] = vtxoff+a;
  idxs[o+1] = vtxoff+b;
  idxs[o+2] = vtxoff+c;
  idxRegions.push([o, 3]);
  return off+3;
}

export function writeQuad(place:BAG.Place, off:number, a:number, b:number, c:number, d:number):number {
  var vtxoff = place.offset;
  var o = (<BAG.Place>place.data[0]).offset+off;
  idxs[o] = vtxoff+a;
  idxs[o+1] = vtxoff+c;
  idxs[o+2] = vtxoff+b;
  idxs[o+3] = vtxoff+a;
  idxs[o+4] = vtxoff+d;
  idxs[o+5] = vtxoff+c;
  idxRegions.push([o, 6]);
  return off+6;
}

export function writeLine(place:BAG.Place, off:number, a:number, b:number):number {
  var vtxoff = place.offset;
  var o = (<BAG.Place>place.data[1]).offset+off;
  idxs[o] = vtxoff+a;
  idxs[o+1] = vtxoff+b;
  idxRegions.push([o, 2]);
  return off+2;
}
