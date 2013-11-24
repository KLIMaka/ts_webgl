/// <reference path="../defs/webgl.d.ts" />

import GLM = require('../libs_js/glmatrix');

export interface VertexBuffer {

  getBuffer(): WebGLBuffer;
  getType(): number;
  getSpacing(): number;
  getNormalized(): boolean;
  getStride(): number;
  getOffset(): number;
}

export interface IndexBuffer {

  getBuffer(): WebGLBuffer;
  getType(): number;
}

export interface DrawData {

  getMode(): number;
  getVertexBuffer(attribute:string): VertexBuffer;
  getAttributes(): string[];
  getIndexBuffer(): IndexBuffer;
  getLength(): number;
  getOffset(): number;
}

class VertexBufferImpl implements VertexBuffer {

  private buffer:WebGLBuffer;
  private type:number;

  constructor(buffer:WebGLBuffer, type:number) {
    this.buffer = buffer;
    this.type = type;
  }

  getBuffer():WebGLBuffer {
    return this.buffer;
  }

  getType():number {
    return this.type;
  }

  getSpacing():number {
    return 3;
  }

  getNormalized():boolean {
    return false;
  }

  getStride():number {
    return 0;
  }

  getOffset():number {
    return 0;
  }
}

class VertexBufferImplLine extends  VertexBufferImpl {

  constructor(buffer:WebGLBuffer, type:number) {
    super(buffer, type);
  }

  getSpacing():number {
    return 2;
  }
}

class IndexBufferImpl implements IndexBuffer {

  private buffer:WebGLBuffer;
  private type:number;

  getBuffer():WebGLBuffer {
    return this.buffer;
  }

  getType():number {
    return this.type;
  }

  constructor(buffer:WebGLBuffer, type:number) {
    this.buffer = buffer;
    this.type = type;
  }
}

export class Mesh implements DrawData {

  private idx:IndexBuffer;
  private mode:number;
  private length:number;
  private vtxBuffers:{[index: string]:VertexBuffer};

  constructor(vtxBuffers:{[index: string]:VertexBuffer}, idx:IndexBuffer, mode:number, length:number) {
    this.vtxBuffers = vtxBuffers;
    this.idx = idx;
    this.mode = mode;
    this.length = length;
  }

  getMode():number {
    return this.mode;
  }

  getVertexBuffer(attribute:string):VertexBuffer {
    return this.vtxBuffers[attribute];
  }

  getAttributes():string[] {
    return Object.keys(this.vtxBuffers);
  }

  getIndexBuffer():IndexBuffer {
    return this.idx;
  }

  getLength():number {
    return this.length;
  }

  getOffset():number {
    return 0;
  }
}

export class WireBuilder {

  private points:number[] = [];
  private indices:number[] = [];
  private lasIndex:number = 0;

  private addVertex(vtx:number[]):void {
    this.points.push(vtx[0], vtx[1]);
  }

  addLine(start:number[], end:number[]) {
    this.addVertex(start);
    this.addVertex(end);
    var idx = this.lasIndex;
    this.indices.push(idx, idx + 1);
    this.lasIndex += 2;
  }

  build(gl:WebGLRenderingContext) {
    var posBuffer = gl.createBuffer();
    var posData = new Float32Array(this.points);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
    var pos = new VertexBufferImplLine(posBuffer, gl.FLOAT);

    var idxBuffer = gl.createBuffer();
    var idxData = new Uint16Array(this.indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
    var idx = new IndexBufferImpl(idxBuffer, gl.UNSIGNED_SHORT);

    return new Mesh(pos, idx, gl.LINES, idxData.length);
  }
}

var a = GLM.vec3.create();
var b = GLM.vec3.create();
var normal = GLM.vec3.create();

export class MeshBuilder {

  private positions:number[] = [];
  private normals:number[] = [];
  private indices:number[] = [];
  private lastIdx = 0;

  private addVertex(vtx:number[]) {
    this.positions.push(vtx[0]);
    this.positions.push(vtx[1]);
    this.positions.push(vtx[2]);
  }

  private addNormal(norm:number[]) {
    this.normals.push(norm[0]);
    this.normals.push(norm[1]);
    this.normals.push(norm[2]);
  }

  addTriangle(verts:number[][]):void {
    this.addVertex(verts[0]);
    this.addVertex(verts[1]);
    this.addVertex(verts[2]);
    GLM.vec3.sub(a, verts[1], verts[0]);
    GLM.vec3.sub(b, verts[2], verts[0]);
    GLM.vec3.cross(normal, b, a);
    GLM.vec3.normalize(normal, normal);
    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);
    var idx = this.lastIdx;
    this.indices.push(idx, idx + 2, idx + 1)
    this.lastIdx += 3;
  }

  addQuad(verts:number[][]):void {
    this.addVertex(verts[0]);
    this.addVertex(verts[1]);
    this.addVertex(verts[2]);
    this.addVertex(verts[3]);
    GLM.vec3.sub(a, verts[1], verts[0]);
    GLM.vec3.sub(b, verts[2], verts[0]);
    GLM.vec3.cross(normal, b, a);
    GLM.vec3.normalize(normal, normal);
    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);
    var idx = this.lastIdx;
    this.indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    this.lastIdx += 4;
  }

  addQuadWNormals(verts:number[][], normals:number[][]):void {
    this.addVertex(verts[0]);
    this.addVertex(verts[1]);
    this.addVertex(verts[2]);
    this.addVertex(verts[3]);
    this.addNormal(normals[0]);
    this.addNormal(normals[1]);
    this.addNormal(normals[2]);
    this.addNormal(normals[3]);
    var idx = this.lastIdx;
    this.indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    this.lastIdx += 4;
  }

  build(gl:WebGLRenderingContext) {
    var posBuffer = gl.createBuffer();
    var posData = new Float32Array(this.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
    var pos = new VertexBufferImpl(posBuffer, gl.FLOAT);

    var normalBuffer = gl.createBuffer();
    var normalData = new Float32Array(this.normals);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normalData, gl.STATIC_DRAW);
    var norm = new VertexBufferImpl(normalBuffer, gl.FLOAT);    

    var idxBuffer = gl.createBuffer();
    var idxData = new Uint16Array(this.indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
    var idx = new IndexBufferImpl(idxBuffer, gl.UNSIGNED_SHORT);

    return new Mesh({pos:pos, norm:norm}, idx, gl.TRIANGLES, idxData.length);
  }
}