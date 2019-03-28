import * as MB from '../../../meshbuilder';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import * as GLM from '../../../../libs_js/glmatrix';
import * as C from '../../../../modules/controller3d';
import * as BATCH from '../../../../modules/batcher';
import * as BUFF from './buffers';
import {Renderable, Type} from './renderable';

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
  private shade:StateValue<number> = new StateValue<number>(0);
  private color:StateValue<GLM.Vec4Array> = new StateValue<GLM.Vec4Array>(GLM.vec4.fromValues(1,1,1,1));
  private plu:StateValue<number> = new StateValue<number>(0);

  private shader:StateValue<DS.Shader> = new StateValue<DS.Shader>(null);
  private texture:StateValue<DS.Texture> = new StateValue<DS.Texture>(null);
  private palTexture:StateValue<DS.Texture> = new StateValue<DS.Texture>(null);
  private pluTexture:StateValue<DS.Texture> = new StateValue<DS.Texture>(null);
  private vertexBuffers:{[index:string]:StateValue<MB.VertexBufferDynamic>} = {};
  private indexBuffer:StateValue<MB.DynamicIndexBuffer> = new StateValue<MB.DynamicIndexBuffer>(null);
  private drawElements:StateValue<BUFF.BufferPointer> = new StateValue<BUFF.BufferPointer>(null);

  constructor(gl:WebGLRenderingContext) {
  }

  public setShader(s:DS.Shader):DS.Shader {
    var prev = this.shader.get();
    this.shader.set(s);
    return prev;
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

  public setPalTexture(tex:DS.Texture) {
    this.palTexture.set(tex);
  }

  public setPluTexture(tex:DS.Texture) {
    this.pluTexture.set(tex);
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

  public setDrawElements(place:BUFF.BufferPointer) {
    this.drawElements.set(place);
  }

  public setShade(s:number) {
    this.shade.set(s);
  }

  public setColor(c:GLM.Vec4Array) {
    var cc = this.color.get();
    if (cc == c || c[0] == cc[0] && c[1] == cc[1] && c[2] == cc[2] && c[3] == cc[3])
      return;
    this.color.set(c);
  }

  public setPal(p:number) {
    this.plu.set(p);
  }

  public setEyePos(pos:GLM.Vec3Array) {
    this.eyePos.set(pos);
  }

  private rebindShader(gl:WebGLRenderingContext):boolean {
    if (this.shader.isChanged()) {
      var shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      gl.uniform1i(shader.getUniformLocation('base', gl), 0);
      gl.uniform1i(shader.getUniformLocation('pal', gl), 1);
      gl.uniform1i(shader.getUniformLocation('plu', gl), 2);
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
    if (this.texture.get() != null && (rebindAll || this.texture.isChanged())) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture.get().get());
      this.texture.setChanged(false);
    }
    if (this.palTexture.get() != null && (rebindAll || this.palTexture.isChanged())) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.palTexture.get().get());
      this.palTexture.setChanged(false);
    }
    if (this.pluTexture.get() != null && (rebindAll || this.pluTexture.isChanged())) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.pluTexture.get().get());
      this.pluTexture.setChanged(false);
    }
  }

  private updateBuffers(gl:WebGLRenderingContext, rebindAll:boolean) {
    BUFF.update(gl);
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
    this.setUniform(gl, BATCH.setters.int1, "shade", this.shade, rebindAll);
    this.setUniform(gl, BATCH.setters.int1, "pluN", this.plu, rebindAll);
    this.setUniform(gl, BATCH.setters.vec4, "color", this.color, rebindAll);
  }

  public draw(gl:WebGLRenderingContext, mode:number=gl.TRIANGLES) {
    var rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateBuffers(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTexture(gl, rebindAll);
    var count = mode == gl.TRIANGLES ? this.drawElements.get().triIdx.size : this.drawElements.get().lineIdx.size;
    var off = mode == gl.TRIANGLES ? this.drawElements.get().triIdx.offset : this.drawElements.get().lineIdx.offset;
    gl.drawElements(mode,count, gl.UNSIGNED_SHORT, off*2);
  }
}

var state:State;
export function init(gl:WebGLRenderingContext, pal:DS.Texture, plu:DS.Texture) {
  createShaders(gl);
  BUFF.init(gl, 1024*1024, 1024*1024);
  state = new State(gl);
  state.setIndexBuffer(BUFF.getIdxBuffer());
  state.setVertexBuffer('aPos', BUFF.getPosBuffer());
  state.setVertexBuffer('aNorm', BUFF.getNormBuffer());
  state.setPalTexture(pal);
  state.setPluTexture(plu);
}

var baseShader:DS.Shader;
var spriteShader:DS.Shader;
var baseFlatShader:DS.Shader;
var spriteFlatShader:DS.Shader;

const SHADER_NAME = 'resources/shaders/build_base1';
function createShaders(gl:WebGLRenderingContext) {
  baseShader = SHADER.createShader(gl, SHADER_NAME);
  spriteShader = SHADER.createShader(gl, SHADER_NAME, ['SPRITE']);
  baseFlatShader = SHADER.createShader(gl, SHADER_NAME, ['FLAT']);
  spriteFlatShader = SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'FLAT']);
}

export function setController(c:C.Controller3D) {
  GLM.mat4.copy(state.getProjectionMatrix(), c.getProjectionMatrix());
  GLM.mat4.copy(state.getViewMatrix(), c.getModelViewMatrix());
  state.setEyePos(c.getCamera().getPos());
}

export function draw(gl:WebGLRenderingContext, renderable:Renderable, mode:number=gl.TRIANGLES) {
  if (renderable.buff.get() == null)
    return;
  state.setShader(renderable.type == Type.SURFACE 
    ? (mode == gl.TRIANGLES ? baseShader : baseFlatShader) 
    : (mode == gl.TRIANGLES ? spriteShader : spriteFlatShader));
  state.setTexture(renderable.tex);
  state.setDrawElements(renderable.buff.get());
  state.setColor([1, 1, 1, renderable.trans]);
  state.setPal(renderable.pal);
  state.setShade(renderable.shade);
  GLM.mat4.copy(state.getTextureMatrix(), renderable.texMat);
  state.draw(gl, mode);
}

