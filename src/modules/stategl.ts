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
      return new StateValue<GLM.Mat4Array>(GLM[type].create(), GLM[type].exactEquals, GLM[type].copy)
    default:
      return new StateValue<number>(0);
  }
}

export class State {
  private shader: StateValue<Shader> = new StateValue<Shader>(null);
  private vertexBuffers: { [index: string]: StateValue<VertexBuffer> } = {};
  private indexBuffer: StateValue<IndexBuffer> = new StateValue<IndexBuffer>(null);
  private drawElements: StateValue<Pointer> = new StateValue<Pointer>(null);

  private uniforms: StateValue<any>[] = [];
  private uniformsNames: string[] = [];
  private uniformsIndex: { [index: string]: number } = {};
  private shaders: { [index: string]: Shader } = {};
  private textures: { [index: string]: StateValue<Texture> } = {};

  public registerShader(name: string, shader: Shader) {
    this.shaders[name] = shader;
    let uniforms = shader.getUniforms();
    for (let u = 0; u < uniforms.length; u++) {
      let uniform = uniforms[u];
      if (this.uniformsIndex[uniform.getName()] != undefined) continue;
      this.uniforms.push(createStateValue(uniform.getType()));
      this.uniformsNames.push(uniform.getName());
      this.uniformsIndex[uniform.getName()] = u;
    }
    let samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      let sampler = samplers[s];
      this.textures[sampler.getName()] = new StateValue<Texture>(null);
    }
  }

  public setUniform(name: string, value: any) {
    let u = this.uniformsIndex[name];
    if (u == undefined) {
      console.warn('Invalid uniform name: ' + name);
      return;
    }
    this.uniforms[u].set(value);
  }

  public setShader(name: string) {
    let s = this.shaders[name];
    if (s == undefined)
      throw new Error('Unknown shader: ' + name);
    this.shader.set(s);
  }

  public setTexture(name: string, tex: Texture) {
    let t = this.textures[name];
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
    let state = this.vertexBuffers[name];
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
      let shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      let samplers = this.shader.get().getSamplers();
      for (let s = 0; s < samplers.length; s++) {
        let sampler = samplers[s];
        this.setUniform(sampler.getName(), s);
      }
      this.shader.setChanged(false);
      return true;
    }
    return false;
  }

  private rebindVertexBuffers(gl: WebGLRenderingContext, rebindAll: boolean) {
    let shader = this.shader.get();
    let attributes = shader.getAttributes();
    for (let a = 0; a < attributes.length; a++) {
      let attr = attributes[a];
      let buf = this.vertexBuffers[attr.getName()];
      if (buf == undefined)
        throw new Error('No buffer for shader attribute <' + attr + '>');
      if (!rebindAll && !buf.isChanged())
        continue;
      let vbuf = buf.get();
      let location = shader.getAttributeLocation(attr.getName(), gl);
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
    let samplers = this.shader.get().getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      let sampler = samplers[s];
      let texture = this.textures[sampler.getName()];
      if (texture != undefined && texture.get() != null && (rebindAll || texture.isChanged())) {
        gl.activeTexture(gl.TEXTURE0 + s);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
        texture.setChanged(false);
      }
    }
  }

  private updateUniforms(gl: WebGLRenderingContext, rebindAll: boolean) {
    for (let u = 0; u < this.uniforms.length; u++) {
      let state = this.uniforms[u];
      if (!rebindAll && !state.isChanged()) continue;
      SHADER.setUniform(gl, this.shader.get(), this.uniformsNames[u], state.get());
      state.setChanged(false);
    }
  }

  public draw(gl: WebGLRenderingContext, mode: number = gl.TRIANGLES) {
    let rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTextures(gl, rebindAll);
    let drawElements = this.drawElements.get();
    drawElements.buffer.update(gl);
    let count = drawElements.idx.size;
    let offset = drawElements.idx.offset;
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, offset * 2);
  }
}