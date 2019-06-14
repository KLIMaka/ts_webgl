import * as BAG from '../../../../libs/bag';
import * as MB from '../../../meshbuilder';
import {BufferBuilder, Buffer, Pointer} from '../../../buffergl';

var buffer:Buffer;

export function init(gl:WebGLRenderingContext, vCount:number) {
  buffer = new Buffer(gl, new BufferBuilder(vCount)
    .addVertexBuffer(gl, 'aPos', gl.FLOAT, 3)
    .addVertexBuffer(gl, 'aNorm', gl.FLOAT, 3));
}

export function getPosBuffer():MB.VertexBufferDynamic {
  return buffer.getVertexBuffer('aPos');
}

export function getNormBuffer():MB.VertexBufferDynamic {
  return buffer.getVertexBuffer('aNorm');
}

export function getIdxBuffer():MB.DynamicIndexBuffer {
  return buffer.getIndexBuffer();
}

export function allocate(vtxSize:number, idxSize:number):Pointer {
  return buffer.allocate(vtxSize, idxSize);
}

export function remove(ptr:Pointer) {
  buffer.deallocate(ptr);
}

export function writePos(ptr:Pointer, off:number, x:number, y:number, z:number):number {
  buffer.writeVertex(ptr, 'aPos', off, [x, y, z]);
  return off+1;
}

export function writeNormal(ptr:Pointer, off:number, x:number, y:number, z:number):number {
  buffer.writeVertex(ptr, 'aNorm', off, [x, y, z]);
  return off+1;
}

export function writeTriangle(ptr:Pointer, off:number, a:number, b:number, c:number):number {
  buffer.writeIndex(ptr, off, [a, b, c]);
  return off+3;
}

export function writeQuad(ptr:Pointer, off:number, a:number, b:number, c:number, d:number):number {
  buffer.writeIndex(ptr, off, [a, c, b, a, d, c]);
  return off+6;
}

export function writeLine(ptr:Pointer, off:number, a:number, b:number):number {
  buffer.writeIndex(ptr, off, [a, b]);
  return off+2;
}

export function getFreeSpace() {
  return buffer.getVertexFreeSpace();
}
