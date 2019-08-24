import { Buffer, BufferBuilder, Pointer } from '../../../buffergl';
import { VertexBuffer, IndexBuffer } from '../../../drawstruct';

let buffers: Buffer[] = [];
let ctx: WebGLRenderingContext;

function createNewBuffer() {
  let buffer = new Buffer(ctx, new BufferBuilder()
    .addVertexBuffer(ctx, 'aPos', ctx.FLOAT, 3)
    .addVertexBuffer(ctx, 'aNorm', ctx.FLOAT, 3)
    .addVertexBuffer(ctx, 'aTc', ctx.FLOAT, 2));
  buffers.push(buffer);
  return buffer;
}

export function init(gl: WebGLRenderingContext) {
  ctx = gl;
  createNewBuffer();
}

export function getPosBuffer(ptr: Pointer): VertexBuffer {
  return ptr.buffer.getVertexBuffer('aPos');
}

export function getNormBuffer(ptr: Pointer): VertexBuffer {
  return ptr.buffer.getVertexBuffer('aNorm');
}

export function getTexCoordBuffer(ptr: Pointer): VertexBuffer {
  return ptr.buffer.getVertexBuffer('aTc');
}

export function getIdxBuffer(ptr: Pointer): IndexBuffer {
  return ptr.buffer.getIndexBuffer();
}

export function allocate(vtxSize: number, idxSize: number): Pointer {
  for (let i = 0; i < buffers.length; i++) {
    let ptr = buffers[i].allocate(vtxSize, idxSize);
    if (ptr != null) return ptr;
  }
  return createNewBuffer().allocate(vtxSize, idxSize);
}

export function remove(ptr: Pointer) {
  ptr.buffer.deallocate(ptr);
}

export function writePos(ptr: Pointer, off: number, x: number, y: number, z: number): number {
  ptr.buffer.writeVertex(ptr, 'aPos', off, [x, y, z]);
  return off + 1;
}

export function writeNormal(ptr: Pointer, off: number, x: number, y: number, z: number): number {
  ptr.buffer.writeVertex(ptr, 'aNorm', off, [x, y, z]);
  return off + 1;
}

export function writeTc(ptr: Pointer, off: number, u: number, v: number): number {
  ptr.buffer.writeVertex(ptr, 'aTc', off, [u, v]);
  return off + 1;
}

export function writeTriangle(ptr: Pointer, off: number, a: number, b: number, c: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, b, c]);
  return off + 3;
}

export function writeQuad(ptr: Pointer, off: number, a: number, b: number, c: number, d: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, c, b, a, d, c]);
  return off + 6;
}

export function writeLine(ptr: Pointer, off: number, a: number, b: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, b]);
  return off + 2;
}