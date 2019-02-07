import MB = require('../../../meshbuilder');
import DS = require('../../../drawstruct');
import SHADER = require('../../../shaders');
import GLM = require('../../../../libs_js/glmatrix');
import C = require('../../../../modules/controller3d');
import BATCH = require('../../../../modules/batcher');

export function init(gl:WebGLRenderingContext) {
  createBuffers(gl);
  createShaders(gl);
}

var pos = new Float32Array(4096);
var posBuf:MB.VertexBufferDynamic;
var norm = new Float32Array(4096);
var normBuf:MB.VertexBufferDynamic;
var idxs = new Uint16Array(1024);
var idxBuf:MB.DynamicIndexBuffer;


function createBuffers(gl:WebGLRenderingContext) {
  posBuf = MB.wrap(gl, pos, 3, gl.DYNAMIC_DRAW);
  normBuf = MB.wrap(gl, norm, 2, gl.DYNAMIC_DRAW);
  idxBuf = MB.wrapIndexBuffer(gl, idxs, gl.DYNAMIC_DRAW);
}

var idxPtr = 0;
var vtxPtr = 0;

export function begin() {
  idxPtr = 0;
  vtxPtr = 0;
}

export function vtx(x:number, y:number, z:number) {
  var posoff = vtxPtr * 3;
  pos[posoff++] = x;
  pos[posoff++] = y;
  pos[posoff++] = z;
  vtxPtr ++;
}

export function normal(x:number, y:number) {
  var normoff = vtxPtr * 2;
  norm[normoff++] = x;
  norm[normoff++] = y;
}

export function triangle(a:number, b:number, c:number) {
  idxs[idxPtr++] = a;
  idxs[idxPtr++] = b;
  idxs[idxPtr++] = c;
}

export function quad(a:number, b:number, c:number, d:number) {
  idxs[idxPtr++] = a;
  idxs[idxPtr++] = c;
  idxs[idxPtr++] = b;
  idxs[idxPtr++] = a;
  idxs[idxPtr++] = d;
  idxs[idxPtr++] = c;
}

export function genQuad(
  x1:number, y1:number, z1:number,
  x2:number, y2:number, z2:number,
  x3:number, y3:number, z3:number,
  x4:number, y4:number, z4:number, twosided:boolean=false):void {
  begin();
  vtx(x1, y1, z1);
  vtx(x2, y2, z2);
  vtx(x3, y3, z3);
  vtx(x4, y4, z4);
  quad(0, 1, 2, 3);
  if (twosided) {
    quad(3, 2, 1, 0);
  }
}

var baseShader:DS.Shader;
var selectShader:DS.Shader;
var spriteShader:DS.Shader;
var spriteSelectShader:DS.Shader;
var currentShader:DS.Shader;

function createShaders(gl:WebGLRenderingContext) {
  baseShader = SHADER.createShader(gl, 'resources/shaders/build_base1');
  selectShader = SHADER.createShader(gl, 'resources/shaders/build_base1', ['SELECT']);
  spriteShader = SHADER.createShader(gl, 'resources/shaders/build_base1', ['SPRITE']);
  spriteSelectShader = SHADER.createShader(gl, 'resources/shaders/build_base1', ['SPRITE', 'SELECT']);
}

var selectDraw = false;
export function selectDrawMode(enable:boolean) {
  selectDraw = enable;
}

var selectedId = -1;
export function setSelectedId(id:number) {
  selectedId = id;
}


var ctr:C.Controller3D;
export function setController(c:C.Controller3D) {
  ctr = c;
}

function vertexBuffer(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  var buf = data[0];
  var name = data[1];
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
  var location = shader.getAttributeLocation(name, gl);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
  return shader;
}

function updateBuffer(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  data.update(gl);
  return shader;
}

function useCurrentShader(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  return data;
}

function bindTexture(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  gl.bindTexture(gl.TEXTURE_2D, data.get());
  return shader;
}

var useBaseShaderCmds = [
  BATCH.shader, () => currentShader = selectDraw ? selectShader : baseShader,
  vertexBuffer, () => [posBuf, 'aPos'],
  BATCH.indexBuffer, () => idxBuf,
  BATCH.uniforms, [
    'MVP', BATCH.setters.mat4, () => ctr.getMatrix(),
    'eyepos', BATCH.setters.vec3, () => ctr.getCamera().getPos(),
    'selectedId', BATCH.setters.int1, () => selectedId
  ]
];

export function useBaseShader(gl:WebGLRenderingContext) {
  BATCH.exec(useBaseShaderCmds, gl);
}

var useSpriteShaderCmds = [
  BATCH.shader, () => currentShader = selectDraw ? spriteSelectShader : spriteShader,
  vertexBuffer, () => [posBuf, 'aPos'],
  vertexBuffer, () => [normBuf, 'aNorm'],
  BATCH.indexBuffer, () => idxBuf,
  BATCH.uniforms, [
    'MV', BATCH.setters.mat4, () => ctr.getModelViewMatrix(),
    'P', BATCH.setters.mat4, () => ctr.getProjectionMatrix(),
    'eyepos', BATCH.setters.vec3, () => ctr.getCamera().getPos(),
    'selectedId', BATCH.setters.int1, () => selectedId
  ]
]

export function useSpriteShader(gl:WebGLRenderingContext) {
  BATCH.exec(useSpriteShaderCmds, gl);
}

var texMat = GLM.mat4.create();
export function getTexureMatrix():GLM.Mat4Array {
  return texMat;
}

var texture:DS.Texture;
var currentId:number;
var currentShade:number;

var drawCmds = [
  useCurrentShader, () => currentShader,
  updateBuffer, () => idxBuf,
  updateBuffer, () => posBuf,
  updateBuffer, () => normBuf,
  bindTexture, () => texture,
  BATCH.uniforms, [
    'currentId', BATCH.setters.int1, () => currentId,
    'shade', BATCH.setters.int1, () => currentShade,
    'texMat', BATCH.setters.mat4, () => texMat
  ],
  BATCH.drawCall, () => [WebGLRenderingContext.TRIANGLES, idxPtr, 0]
]

export function drawFace(gl:WebGLRenderingContext, tex:DS.Texture, shade:number, id:number) {
  texture = tex;
  currentId = id;
  currentShade = shade;
  BATCH.exec(drawCmds, gl);
}