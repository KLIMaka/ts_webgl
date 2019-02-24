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


var vtxRegions = [];
var nrmRegions = [];
var idxRegions = [];

function updateBuffer(gl:WebGLRenderingContext, buffer:any, regions:number[][]) {
  if (regions.length == 0)
    return;
  for (var i = 0; i < regions.length; i++) {
    var region = vtxRegions[i];
    buffer.updateRegion(gl, region[0], region[1]);
  }
  regions = [];
}

export function update(gl:WebGLRenderingContext) {
  updateBuffer(gl, posBuf, vtxRegions);
  updateBuffer(gl, normBuf, nrmRegions);
  updateBuffer(gl, idxBuf, idxRegions);
}

export function allocate(vtxSize:number, idxSize:number):BAG.Place {
  var vtx = vtxBag.get(vtxSize);
  var idx = idxBag.get(idxSize);
  vtx.data = idx;
  return vtx;
}

export function remove(place:BAG.Place) {
  idxBag.put(place.data);
  vtxBag.put(place);
}

export function writePos(place:BAG.Place, off:number, x:number, y:number, z:number):number {
  var off = place.offset+off;
  pos[off*3] = x;
  pos[off*3+1] = y;
  pos[off*3+2] = z;
  vtxRegions.push([off, 3]);
  return off+3;
}

export function writeNormal(place:BAG.Place, off:number, x:number, y:number):number {
  var off = place.offset+off;
  norm[off*2] = x;
  norm[off*2+1] = y;
  nrmRegions.push([off, 2]);
  return off+2;
}

export function writeTriangle(place:BAG.Place, off:number, a:number, b:number, c:number):number {
  var off = (<BAG.Place>place.data).offset+off;
  idxs[off] = a;
  idxs[off+1] = b;
  idxs[off+2] = c;
  idxRegions.push([off, 3]);
  return off+3;
}

export function writeQuad(place:BAG.Place, off:number, a:number, b:number, c:number, d:number):number {
  var off = (<BAG.Place>place.data).offset+off;
  idxs[off] = a;
  idxs[off+1] = c;
  idxs[off+2] = b;
  idxs[off+3] = a;
  idxs[off+4] = d;
  idxs[off+5] = c;
  idxRegions.push([off, 6]);
  return off+6;
}

export function writeLine(place:BAG.Place, off:number, a:number, b:number):number {
  var off = (<BAG.Place>place.data).offset+off;
  idxs[off] = a;
  idxs[off+1] = b;
  idxRegions.push([off, 2]);
  return off+2;
}
