import * as SHADER from './shaders';
import * as GLM from '../libs_js/glmatrix';
import { Pointer } from './buffergl';
import { Shader, VertexBuffer, IndexBuffer, Texture } from './drawstruct';

function eqCmp<T>(lh: T, rh: T) { return lh == rh }
function assign<T>(dst: T, src: T) { return src }

class StateValue<T> {
  public changed: boolean = false;
  constructor(
    public value: T,
    public cmp: (lh: T, rh: T) => boolean = eqCmp,
    public setter: (dst: T, src: T) => T = assign
  ) { }
  get(): T { return this.value; }
  set(v: T) { if (!this.cmp(v, this.value)) { this.value = this.setter(this.value, v); this.changed = true; } }
  isChanged() { return this.changed; }
  setChanged(c: boolean) { this.changed = c; }
}

function createStateValue(type: string): StateValue<any> {
  switch (type) {
    case "mat4":
    case "vec3":
    case "vec4":
      return new StateValue<GLM.Mat4Array>(GLM[type].create(), GLM[type].equals, GLM[type].copy)
    default:
      return new StateValue<number>(0);
  }
}

export class State {
  private shader: StateValue<Shader> = new StateValue<Shader>(null);
  private vertexBuffers: { [index: string]: StateValue<VertexBuffer> } = {};
  private indexBuffer: StateValue<IndexBuffer> = new StateValue<IndexBuffer>(null);
  private drawElements: StateValue<Pointer> = new StateValue<Pointer>(null);

  private uniforms: { [index: string]: StateValue<any> } = {};
  private shaders: { [index: string]: Shader } = {};
  private textures: { [index: string]: StateValue<Texture> } = {};

  public registerShader(name: string, shader: Shader) {
    this.shaders[name] = shader;
    var uniforms = shader.getUniforms();
    for (var u in uniforms) {
      var uniform = uniforms[u];
      this.uniforms[u] = createStateValue(uniform.getType());
    }
    var samplers = shader.getSamplers();
    for (var s in samplers) {
      var sampler = samplers[s];
      this.textures[s] = new StateValue<Texture>(null);
    }
  }

  public setUniform(name: string, value: any) {
    var u = this.uniforms[name];
    if (u == undefined) {
      console.warn('Invalid uniform name: ' + name);
      return;
    }
    u.set(value);
  }

  public setShader(name: string) {
    var s = this.shaders[name];
    if (s == undefined)
      throw new Error('Unknown shader: ' + name);
    this.shader.set(s);
  }

  public setTexture(name: string, tex: Texture) {
    var t = this.textures[name];
    if (t == undefined) {
      console.warn('Invalid sampler name: ' + name);
      return;
    }
    t.set(tex);
  }

  public setIndexBuffer(b: IndexBuffer) {
    this.indexBuffer.set(b);
  }

  public setVertexBuffer(name: string, b: VertexBuffer) {
    var state = this.vertexBuffers[name];
    if (state == undefined) {
      state = new StateValue<VertexBuffer>(null);
      this.vertexBuffers[name] = state;
    }
    state.set(b);
  }

  public setDrawElements(ptr: Pointer) {
    this.drawElements.set(ptr);
  }

  private rebindShader(gl: WebGLRenderingContext): boolean {
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

  private rebindVertexBuffers(gl: WebGLRenderingContext, rebindAll: boolean) {
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

  private rebindIndexBuffer(gl: WebGLRenderingContext, rebindAll: boolean) {
    if (rebindAll || this.indexBuffer.isChanged()) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
      this.indexBuffer.setChanged(false);
    }
  }

  private rebindTextures(gl: WebGLRenderingContext, rebindAll: boolean) {
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

  private updateUniforms(gl: WebGLRenderingContext, rebindAll: boolean) {
    var uniforms = this.shader.get().getUniforms();
    for (var u in uniforms) {
      var state = this.uniforms[u];
      if (state == undefined)
        continue;
      if (rebindAll || state.isChanged()) {
        SHADER.setUniform(gl, this.shader.get(), u, state.get());
        state.setChanged(false);
      }
    }
  }

  public draw(gl: WebGLRenderingContext, mode: number = gl.TRIANGLES) {
    var rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTextures(gl, rebindAll);
    let drawElements = this.drawElements.get();
    drawElements.buffer.update(gl);
    var count = drawElements.idx.size;
    var offset = drawElements.idx.offset;
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, offset * 2);
  }
}