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

class VertexBufferBuilder {

  private buffer:number[] = [];

  constructor(
    private arrayType:any,
    private type:number, 
    private spacing:number, 
    private normalized:boolean,
    private stride:number,
    private offset:number
  ) {}

  public push(data:number[]):void {
    this.buffer = this.buffer.concat(data);
  }

  public build(gl:WebGLRenderingContext):VertexBuffer {
    var bufIdx = gl.createBuffer();
    var data = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return new VertexBufferImpl(bufIdx, this.type, this.spacing, this.normalized, this.stride, this.offset);
  }
}

class VertexBufferImpl implements VertexBuffer {

  constructor(
    private buffer:WebGLBuffer, 
    private type:number, 
    private spacing:number = 3, 
    private normalized:boolean = false, 
    private stride:number = 0, 
    private offset:number = 0
  ) {}

  getBuffer():WebGLBuffer {
    return this.buffer;
  }

  getType():number {
    return this.type;
  }

  getSpacing():number {
    return this.spacing;
  }

  getNormalized():boolean {
    return this.normalized;
  }

  getStride():number {
    return this.stride;
  }

  getOffset():number {
    return this.offset;
  }
}

class VertexBufferImplLine extends  VertexBufferImpl {

  constructor(buffer:WebGLBuffer, type:number) {
    super(buffer, type, 2);
  }
}

export var NONE = 0;
export var TRIANGLES = 3;
export var QUADS = 4;

class IndexBufferBuilder {

  private buffer:number[] = [];
  private idx = 0;
  private mode = NONE;
  private vtxCounter = 0;

  constructor(
    private arrayType:any,
    private type:number
  ) {}

  public setMode(mode:number):void {
    if (this.vtxCounter != 0)
      throw new Error('Incomplete primitive!');
    this.mode = mode;
    this.vtxCounter = 0;
  }

  public vtx():void {
    this.vtxCounter++;
    if (this.mode == TRIANGLES && this.vtxCounter % 3 == 0) {
      this.pushTriangle();
      this.vtxCounter = 0;
    }
    if (this.mode == QUADS && this.vtxCounter % 4 == 0) {
      this.pushQuad();
      this.vtxCounter = 0;
    }
  }

  private pushTriangle():void {
    var idx = this.idx;
    this.buffer.push(idx, idx + 2, idx + 1)
    this.idx += 3;
  }

  private pushQuad():void {
    var idx = this.idx;
    this.buffer.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    this.idx += 4;
  }

  public length():number {
    return this.idx;
  }

  public build(gl:WebGLRenderingContext):IndexBuffer {
    var bufIdx = gl.createBuffer();
    var data = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return new IndexBufferImpl(bufIdx, this.type);
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

export class MeshBuilder1 {

  private attrs = {};

  constructor(
    private buffers:any, 
    private idx:IndexBufferBuilder
  ) {}

  public start(mode:number):MeshBuilder1 {
    this.idx.setMode(mode);
    return this;
  }

  public attr(attr:string, data:number[]):MeshBuilder1 {
    this.attrs[attr] = data;
    return this;
  }

  public vtx(vtxAttr:string, data:number[]):MeshBuilder1 {
    this.attrs[vtxAttr] = data;
    for (var attr in this.attrs) {
      this.buffers[attr].push(this.attrs[attr]);
    }
    this.idx.vtx();
  }

  public end():void {
    this.idx.setMode(NONE);
    this.attrs = {};
  }

  public build(gl:WebGLRenderingContext):DrawData {
    var bufs = {};
    for (var bufName in this.buffers) {
      bufs[bufName] = this.buffers[bufName].build(gl);
    }
    var idx = this.idx.build(gl);
    return new Mesh(bufs, idx, gl.TRIANGLES, this.idx.length());
  }
}

export class MeshBuilderConstructor {

  private buffers = {};
  private idx:IndexBufferBuilder;

  public buffer(name:string, arrayType:any, type:number, spacing:number, normalized:boolean=false):MeshBuilderConstructor {
    this.buffers[name] = new VertexBufferBuilder(arrayType, type, spacing, normalized, 0, 0);
    return this;
  }

  public index(idxArrayType:any, idxType:number):MeshBuilderConstructor {
    this.idx = new IndexBufferBuilder(idxArrayType, idxType);
    return this;
  }

  public build():MeshBuilder1 {
    return new MeshBuilder1(this.buffers, this.idx);
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

  private genNormal(verts:number[][]):number[] {
    GLM.vec3.sub(a, verts[1], verts[0]);
    GLM.vec3.sub(b, verts[2], verts[0]);
    GLM.vec3.cross(normal, b, a);
    GLM.vec3.normalize(normal, normal);
    return normal;
  }

  private genIndexesQuad():void {
    var idx = this.lastIdx;
    this.indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    this.lastIdx += 4;
  }

  private genIndexesTri():void {
    var idx = this.lastIdx;
    this.indices.push(idx, idx + 2, idx + 1)
    this.lastIdx += 3;
  }
 
  addTriangle(verts:number[][]):void {
    this.addVertex(verts[0]);
    this.addVertex(verts[1]);
    this.addVertex(verts[2]);

    normal = this.genNormal(verts);

    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);

    this.genIndexesTri();
  }

  addQuad(verts:number[][]):void {
    this.addVertex(verts[0]);
    this.addVertex(verts[1]);
    this.addVertex(verts[2]);
    this.addVertex(verts[3]);

    normal = this.genNormal(verts);

    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);
    this.addNormal(normal);

    this.genIndexesQuad();
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

    this.genIndexesQuad();
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