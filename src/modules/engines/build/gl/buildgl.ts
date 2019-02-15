import MB = require('../../../meshbuilder');
import DS = require('../../../drawstruct');
import SHADER = require('../../../shaders');
import GLM = require('../../../../libs_js/glmatrix');
import C = require('../../../../modules/controller3d');
import BATCH = require('../../../../modules/batcher');

class StateValue<T> {
  public changed:boolean = false;
  constructor(public value:T) {}
  get():T {return this.value;}
  set(v:T) {if (this.value != v) {this.value = v; this.changed = true;}}
  isChanged() {return this.changed;}
  setChanged(c:boolean) {this.changed = c;}
}

class State {
  private textureMatrix:StateValue<GLM.Mat4Array> = new StateValue<GLM.Mat4Array>(GLM.mat4.create());
  private viewMatrix:StateValue<GLM.Mat4Array> = new StateValue<GLM.Mat4Array>(GLM.mat4.create());
  private projectionMatrix:StateValue<GLM.Mat4Array> = new StateValue<GLM.Mat4Array>(GLM.mat4.create());

  private eyePos:StateValue<GLM.Vec3Array> = new StateValue<GLM.Vec3Array>(GLM.vec3.create());
  private currentId:StateValue<number> = new StateValue<number>(-1);
  private selectedId:StateValue<number> = new StateValue<number>(-1);
  private shade:StateValue<number> = new StateValue<number>(0);
  private color:StateValue<GLM.Vec3Array> = new StateValue<GLM.Vec3Array>(GLM.vec3.create());

  private shader:StateValue<DS.Shader> = new StateValue<DS.Shader>(null);
  private texture:StateValue<DS.Texture> = new StateValue<DS.Texture>(null);
  private vertexBuffers:{[index:string]:StateValue<MB.VertexBufferDynamic>} = {};
  private indexBuffer:StateValue<MB.DynamicIndexBuffer> = new StateValue<MB.DynamicIndexBuffer>(null);
  private indexLength:StateValue<number> = new StateValue<number>(0);

  constructor(gl:WebGLRenderingContext) {
  }

  public setShader(s:DS.Shader) {
    this.shader.set(s);
  }

  public getTextureMatrix():GLM.Mat4Array {
    this.textureMatrix.setChanged(true);
    return this.textureMatrix.get();
  }

  public getViewMatrix():GLM.Mat4Array {
    this.viewMatrix.setChanged(true);
    return this.viewMatrix.get();
  }

  public getProjectionMatrix():GLM.Mat4Array {
    this.projectionMatrix.setChanged(true);
    return this.projectionMatrix.get();
  }

  public setTexture(tex:DS.Texture) {
    this.texture.set(tex);
  }

  public setIndexBuffer(b:MB.DynamicIndexBuffer) {
    this.indexBuffer.set(b);
  }

  public setVertexBuffer(name:string, b:MB.VertexBufferDynamic) {
    var state = this.vertexBuffers[name];
    if (state == undefined) {
      state = new StateValue<MB.VertexBufferDynamic>(null);
      this.vertexBuffers[name] = state;
    }
    state.set(b);
  }

  public setIndexLength(l:number) {
    this.indexLength.set(l);
    this.indexLength.setChanged(true);
  }

  public setCurrentId(id:number) {
    this.currentId.set(id);
  }

  public setSelectedId(id:number) {
    this.selectedId.set(id);
  }

  public setShade(s:number) {
    this.shade.set(s);
  }

  public setColor(c:GLM.Vec3Array) {
    var cc = this.color.get();
    if (cc == c || c[0] == cc[0] && c[1] == cc[1] && c[2] == cc[2])
      return;
    this.color.set(c);
  }

  public setEyePos(pos:GLM.Vec3Array) {
    this.eyePos.set(pos);
  }

  private rebindShader(gl:WebGLRenderingContext):boolean {
    if (this.shader.isChanged()) {
      var shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      gl.uniform1i(shader.getUniformLocation('base', gl), 0);
      gl.activeTexture(gl.TEXTURE0);
      this.shader.setChanged(false);  
      return true;
    }
    return false;
  }

  private rebindVertexBuffers(gl:WebGLRenderingContext, rebindAll:boolean) {
    var shader = this.shader.get();
    var attributes = shader.getAttributes();
    for (var a = 0; a < attributes.length; a++) {
      var attr = attributes[a];
      var buf = this.vertexBuffers[attr];
      if (buf == undefined)
        throw new Error('No buffer for shader attribute <' + attr + '>');
      if (!rebindAll && !buf.isChanged())
        continue;
      var vbuf = buf.get();
      var location = shader.getAttributeLocation(attr, gl);
      if (location == -1)
        continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, vbuf.getSpacing(), vbuf.getType(), vbuf.getNormalized(), vbuf.getStride(), vbuf.getOffset());
      buf.setChanged(false);
    }
  }

  private rebindIndexBuffer(gl:WebGLRenderingContext, rebindAll:boolean) {
    if (rebindAll || this.indexBuffer.isChanged()) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
      this.indexBuffer.setChanged(false);
    }
  }

  private rebindTexture(gl:WebGLRenderingContext, rebindAll:boolean) {
    if (rebindAll || this.texture.isChanged()) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture.get().get());
      this.texture.setChanged(false);
    }
  }

  private updateBuffers(gl:WebGLRenderingContext, rebindAll:boolean) {
    if (rebindAll || this.indexLength.isChanged()) {
      this.indexBuffer.get().update(gl);
      var attributes = this.shader.get().getAttributes();
      for (var a = 0; a < attributes.length; a++) {
        var attr = attributes[a];
        var buf = this.vertexBuffers[attr];
        if (buf == undefined)
          continue;
        buf.get().update(gl);
      }
      this.indexLength.setChanged(false);
    }
  }

  private setUniform<T>(gl:WebGLRenderingContext, setter, name, value:StateValue<T>, rebindAll:boolean) {
    if (rebindAll || value.isChanged()) {
      var l = this.shader.get().getUniformLocation(name, gl);
      setter(gl, l, value.get())
      value.setChanged(false);
    }
  }

  private updateUniforms(gl:WebGLRenderingContext, rebindAll:boolean) {
    this.setUniform(gl, BATCH.setters.mat4, "T", this.textureMatrix, rebindAll);
    this.setUniform(gl, BATCH.setters.mat4, "V", this.viewMatrix, rebindAll);
    this.setUniform(gl, BATCH.setters.mat4, "P", this.projectionMatrix, rebindAll);
    this.setUniform(gl, BATCH.setters.vec3, "eyepos", this.eyePos, rebindAll);
    this.setUniform(gl, BATCH.setters.int1, "selectedId", this.selectedId, rebindAll);
    this.setUniform(gl, BATCH.setters.int1, "currentId", this.currentId, rebindAll);
    this.setUniform(gl, BATCH.setters.int1, "shade", this.shade, rebindAll);
    this.setUniform(gl, BATCH.setters.vec3, "color", this.color, rebindAll);
  }

  public draw(gl:WebGLRenderingContext) {
    var rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateBuffers(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTexture(gl, rebindAll);
    gl.drawElements(gl.TRIANGLES, this.indexLength.get(), gl.UNSIGNED_SHORT, 0);
  }
}

var state:State;
export function init(gl:WebGLRenderingContext) {
  state = new State(gl);
  createBuffers(gl);
  createShaders(gl);
  state.setIndexBuffer(idxBuf);
  state.setVertexBuffer('aPos', posBuf);
  state.setVertexBuffer('aNorm', normBuf);
  state.setColor(GLM.vec3.fromValues(1,1,1));
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


var pos = new Float32Array(512);
var posBuf:MB.VertexBufferDynamic;
var norm = new Float32Array(512);
var normBuf:MB.VertexBufferDynamic;
var idxs = new Uint16Array(256);
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
  state.setIndexLength(idxPtr);
}

export function quad(a:number, b:number, c:number, d:number) {
  idxs[idxPtr++] = a;
  idxs[idxPtr++] = c;
  idxs[idxPtr++] = b;
  idxs[idxPtr++] = a;
  idxs[idxPtr++] = d;
  idxs[idxPtr++] = c;
  state.setIndexLength(idxPtr);
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

var selectDraw = false;
export function selectDrawMode(enable:boolean) {
  selectDraw = enable;
}

export function setSelectedId(id:number) {
  state.setSelectedId(id);
}

export function setController(c:C.Controller3D) {
  GLM.mat4.copy(state.getProjectionMatrix(), c.getProjectionMatrix());
  GLM.mat4.copy(state.getViewMatrix(), c.getModelViewMatrix());
  state.setEyePos(c.getCamera().getPos());
}

export function useBaseShader(gl:WebGLRenderingContext) {
  state.setShader(selectDraw ? selectShader : baseShader);
}

export function useSpriteShader(gl:WebGLRenderingContext) {
  state.setShader(selectDraw ? spriteSelectShader : spriteShader);
}

export function getTexureMatrix():GLM.Mat4Array {
  return state.getTextureMatrix();
}

export function drawFace(gl:WebGLRenderingContext, tex:DS.Texture, shade:number, id:number) {
  state.setTexture(tex);
  state.setCurrentId(id);
  state.setShade(shade);
  state.draw(gl);
}