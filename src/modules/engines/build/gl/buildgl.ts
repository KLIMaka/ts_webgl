import * as MB from '../../../meshbuilder';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import * as GLM from '../../../../libs_js/glmatrix';
import * as C from '../../../../modules/controller3d';
import * as BATCH from '../../../../modules/batcher';
import * as BUFF from './buffers';
import {Renderable, Type} from './renderable';

function eqCmp<T>(lh:T, rh:T) {return lh == rh}
function assign<T>(dst:T, src:T) {return src}

class StateValue<T> {
  public changed:boolean = false;
  constructor(
    public value:T, 
    public cmp:(lh:T, rh:T) => boolean=eqCmp,
    public setter:(dst:T, src:T) => T=assign
  ) {}
  get():T {return this.value;}
  set(v:T) {if (!this.cmp(v, this.value)) {this.value = this.setter(this.value, v); this.changed = true;}}
  isChanged() {return this.changed;}
  setChanged(c:boolean) {this.changed = c;}
}

function createStateValue(type:string):StateValue<any> {
  switch (type) {
    case "mat4": return new StateValue<GLM.Mat4Array>(GLM.mat4.create(), GLM.mat4.equals, GLM.mat4.copy);
    case "vec3": return new StateValue<GLM.Vec3Array>(GLM.vec3.create(), GLM.vec3.equals, GLM.vec3.copy);
    case "vec4": return new StateValue<GLM.Vec3Array>(GLM.vec4.create(), GLM.vec4.equals, GLM.vec4.copy);
    default:     return new StateValue<number>(0);
  }
}


class State {
  private shader:StateValue<DS.Shader> = new StateValue<DS.Shader>(null);
  private vertexBuffers:{[index:string]:StateValue<MB.VertexBufferDynamic>} = {};
  private indexBuffer:StateValue<MB.DynamicIndexBuffer> = new StateValue<MB.DynamicIndexBuffer>(null);
  private drawElements:StateValue<BUFF.BufferPointer> = new StateValue<BUFF.BufferPointer>(null);

  private uniforms:{[index:string]:StateValue<any>} = {};
  private shaders:{[index:string]:DS.Shader} = {};
  private textures:{[index:string]:StateValue<DS.Texture>} = {};

  constructor(gl:WebGLRenderingContext) {
  }

  public registerShader(name:string, shader:DS.Shader) {
    this.shaders[name] = shader;
    var uniforms = shader.getUniforms();
    for (var u in uniforms) {
      var uniform = uniforms[u];
      this.uniforms[u] = createStateValue(uniform.getType());
    }
    var samplers = shader.getSamplers();
    for (var s in samplers) {
      var sampler = samplers[s];
      this.textures[s] = new StateValue<DS.Texture>(null);
    }
  }

  public setUniform(name:string, value) {
    var u = this.uniforms[name];
    if (u == undefined) {
      console.warn('Invalid uniform name: ' + name);
      return;
    }
    u.set(value);
  }

  public setShader(s:DS.Shader):DS.Shader {
    var prev = this.shader.get();
    this.shader.set(s);
    return prev;
  }

  public setTexture(name:string, tex:DS.Texture) {
    var t = this.textures[name];
    if (t == undefined) {
      console.warn('Invalid sampler name: ' + name);
      return;
    }
    t.set(tex);
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

  private rebindShader(gl:WebGLRenderingContext):boolean {
    if (this.shader.isChanged()) {
      var shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      var samplers = this.shader.get().getSamplers();
      var unit = 0;
      for (var s in samplers) {
        this.setUniform(s, unit++);
      }
      this.shader.setChanged(false);  
      return true;
    }
    return false;
  }

  private rebindVertexBuffers(gl:WebGLRenderingContext, rebindAll:boolean) {
    var shader = this.shader.get();
    var attributes = shader.getAttributes();
    for (var a in attributes) {
      var attr = attributes[a];
      var buf = this.vertexBuffers[attr.getName()];
      if (buf == undefined)
        throw new Error('No buffer for shader attribute <' + attr + '>');
      if (!rebindAll && !buf.isChanged())
        continue;
      var vbuf = buf.get();
      var location = shader.getAttributeLocation(attr.getName(), gl);
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

  private rebindTextures(gl:WebGLRenderingContext, rebindAll:boolean) {
    var samplers = this.shader.get().getSamplers();
    var unit = 0;
    for (var s in samplers) {
      var sampler = samplers[s];
      var texture = this.textures[s];
      if (texture != undefined && texture.get() != null && (rebindAll || texture.isChanged())) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
        texture.setChanged(false);
      }
      unit++;
    }
  }

  private updateBuffers(gl:WebGLRenderingContext, rebindAll:boolean) {
    BUFF.update(gl);
  }

  private setUniformImpl<T>(gl:WebGLRenderingContext, name, value:StateValue<T>, rebindAll:boolean) {
    if (rebindAll || value.isChanged()) {
      SHADER.setUniform(gl, this.shader.get(), name, value.get());
      value.setChanged(false);
    }
  }

  private updateUniforms(gl:WebGLRenderingContext, rebindAll:boolean) {
    var uniforms = this.shader.get().getUniforms();
    for (var u in uniforms) {
      var state = this.uniforms[u];
      if (state == undefined)
        continue;
      this.setUniformImpl(gl, u, state, rebindAll);
    }
  }

  public draw(gl:WebGLRenderingContext, mode:number=gl.TRIANGLES) {
    var rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateBuffers(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTextures(gl, rebindAll);
    var count = mode == gl.TRIANGLES ? this.drawElements.get().triIdx.size : this.drawElements.get().lineIdx.size;
    var off = mode == gl.TRIANGLES ? this.drawElements.get().triIdx.offset : this.drawElements.get().lineIdx.offset;
    gl.drawElements(mode,count, gl.UNSIGNED_SHORT, off*2);
  }
}

var state:State;
export function init(gl:WebGLRenderingContext, pal:DS.Texture, plu:DS.Texture) {
  BUFF.init(gl, 1024*1024, 1024*1024);
  state = new State(gl);
  state.setIndexBuffer(BUFF.getIdxBuffer());
  state.setVertexBuffer('aPos', BUFF.getPosBuffer());
  state.setVertexBuffer('aNorm', BUFF.getNormBuffer());
  state.setTexture('pal', pal);
  state.setTexture('plu', plu);
  createShaders(gl, state);
}

var baseShader:DS.Shader;
var spriteShader:DS.Shader;
var baseFlatShader:DS.Shader;
var spriteFlatShader:DS.Shader;

const SHADER_NAME = 'resources/shaders/build_base1';
function createShaders(gl:WebGLRenderingContext, state:State) {
  baseShader = SHADER.createShader(gl, SHADER_NAME, ['TC_GRID', 'PAL_LIGHTING'], (s)=>state.registerShader('baseShader', baseShader));
  spriteShader = SHADER.createShader(gl, SHADER_NAME, ['SPRITE'], (s)=>state.registerShader('spriteShader', spriteShader));
  baseFlatShader = SHADER.createShader(gl, SHADER_NAME, ['FLAT'], (s)=>state.registerShader('baseFlatShader', baseFlatShader));
  spriteFlatShader = SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'FLAT'], (s)=>state.registerShader('spriteFlatShader', spriteFlatShader));
}

export function setController(c:C.Controller3D) {
  state.setUniform('P', c.getProjectionMatrix());
  state.setUniform('V', c.getModelViewMatrix());
  state.setUniform('eyepos', c.getCamera().getPos());
}

export function setCursorPosiotion(pos:GLM.Vec3Array) {
  state.setUniform('curpos', pos);
}

export function draw(gl:WebGLRenderingContext, renderable:Renderable, mode:number=gl.TRIANGLES) {
  if (renderable.buff.get() == null)
    return;
  state.setShader(renderable.type == Type.SURFACE 
    ? (mode == gl.TRIANGLES ? baseShader : baseFlatShader) 
    : (mode == gl.TRIANGLES ? spriteShader : spriteFlatShader));
  state.setTexture('base', renderable.tex);
  state.setDrawElements(renderable.buff.get());
  state.setUniform('color', [1, 1, 1, renderable.trans]);
  state.setUniform('pluN', renderable.pal);
  state.setUniform('shade', renderable.shade);
  state.setUniform('T', renderable.texMat);
  state.draw(gl, mode);
}

