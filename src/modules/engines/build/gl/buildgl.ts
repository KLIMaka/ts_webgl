import MB = require('../../../meshbuilder');
import DS = require('../../../drawstruct');
import SHADER = require('../../../shaders');
import GLM = require('../../../../libs_js/glmatrix');
import C = require('../../../../modules/controller3d');

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
  var base = vtxPtr - 4;
  quad(base, base+1, base+2, base+3);
  if (twosided) {
    quad(base+3, base+2, base+1, base);
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

function bindBuffer(gl:WebGLRenderingContext, shader:DS.Shader, buf:DS.VertexBuffer, name:string) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
  var location = currentShader.getAttributeLocation(name, gl);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
}

export function useBaseShader(gl:WebGLRenderingContext, ctr:C.Controller3D) {
  currentShader = selectDraw ? selectShader : baseShader;
  gl.useProgram(currentShader.getProgram());
  bindBuffer(gl, currentShader, posBuf, 'aPos');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
  gl.uniformMatrix4fv(currentShader.getUniformLocation('MVP', gl), false, ctr.getMatrix());
  gl.uniform3fv(currentShader.getUniformLocation('eyepos', gl), ctr.getCamera().getPos());
  gl.uniform1i(currentShader.getUniformLocation('selectedId', gl), selectedId);
}

export function useSpriteShader(gl:WebGLRenderingContext, ctr:C.Controller3D) {
  currentShader = selectDraw ? spriteSelectShader : spriteShader;
  gl.useProgram(currentShader.getProgram());
  bindBuffer(gl, currentShader, posBuf, 'aPos');
  bindBuffer(gl, currentShader, normBuf, 'aNorm');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
  gl.uniformMatrix4fv(currentShader.getUniformLocation('MV', gl), false, ctr.getModelViewMatrix());
  gl.uniformMatrix4fv(currentShader.getUniformLocation('P', gl), false, ctr.getProjectionMatrix());
  gl.uniform3fv(currentShader.getUniformLocation('eyepos', gl), ctr.getCamera().getPos());
  gl.uniform1i(currentShader.getUniformLocation('selectedId', gl), selectedId);
}

var texMat = GLM.mat4.create();
export function getTexureMatrix():GLM.Mat4Array {
  return texMat;
}

export function drawFace(gl:WebGLRenderingContext, tex:DS.Texture, shade:number, id:number) {
  idxBuf.update(gl);
  posBuf.update(gl);
  normBuf.update(gl);
  gl.bindTexture(gl.TEXTURE_2D, tex.get());
  gl.uniform1i(currentShader.getUniformLocation('currentId', gl), id);
  gl.uniform1i(currentShader.getUniformLocation('shade', gl), shade);
  gl.uniformMatrix4fv(currentShader.getUniformLocation('texMat', gl), false, texMat);
  gl.drawElements(gl.TRIANGLES, idxPtr, gl.UNSIGNED_SHORT, 0);
}