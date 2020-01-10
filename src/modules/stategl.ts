import * as SHADER from './shaders';
import * as GLM from '../libs_js/glmatrix';
import { Pointer } from './buffergl';
import { Shader, VertexBuffer, IndexBuffer, Texture, Definition } from './drawstruct';
import { Deck } from './collections';

function eqCmp<T>(lh: T, rh: T) { return lh === rh }
function assign<T>(dst: T, src: T) { return src }

export class StateValue<T> {
  public changed: boolean = false;
  constructor(
    public value: T,
    public cmp: (lh: T, rh: T) => boolean = eqCmp,
    public setter: (dst: T, src: T) => T = assign
  ) { }
  get(): T { return this.value; }
  set(v: T) { if (!this.cmp(v, this.value)) { this.value = this.setter(this.value, v); this.changed = true; } }
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
  private indexBuffer: StateValue<IndexBuffer> = new StateValue<IndexBuffer>(null);
  private drawElements: StateValue<Pointer> = new StateValue<Pointer>(null);
  private shaders: { [index: string]: Shader } = {};

  private vertexBuffers: StateValue<VertexBuffer>[] = [];
  private vertexBufferNames: string[] = [];
  private vertexBufferIndex: { [index: string]: number } = {};

  private uniforms: StateValue<any>[] = [];
  private uniformsDefinitions: Definition[] = [];
  private uniformsIndex: { [index: string]: number } = {};

  private textures: StateValue<Texture>[] = [];
  private texturesNames: string[] = [];
  private texturesIndex: { [index: string]: number } = {};

  private currentTexturesIdxs = new Deck<number>();
  private currentUniformIdxs = new Deck<number>();


  public registerShader(name: string, shader: Shader) {
    this.shaders[name] = shader;
    const uniforms = shader.getUniforms();
    for (let u = 0; u < uniforms.length; u++) {
      const uniform = uniforms[u];
      if (this.uniformsIndex[uniform.name] != undefined) continue;
      const idx = this.uniforms.length;
      this.uniforms.push(createStateValue(uniform.type));
      this.uniformsDefinitions.push(uniform);
      this.uniformsIndex[uniform.name] = idx;
    }
    const samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      if (this.texturesIndex[sampler.name] != undefined) continue;
      const idx = this.textures.length;
      this.textures.push(new StateValue<Texture>(null));
      this.texturesNames.push(sampler.name);
      this.texturesIndex[sampler.name] = idx;
    }
  }

  public setUniform(name: string, value: any) {
    this.getUniformValue(name).set(value);
  }

  public getUniformValue(name: string): StateValue<any> {
    const u = this.uniformsIndex[name];
    if (u == undefined) throw new Error('Invalid uniform name: ' + name);
    return this.uniforms[u];
  }

  public isUniformEnabled(name: string): boolean {
    return this.uniformsIndex[name] != undefined;
  }

  public setShader(name: string) {
    const s = this.shaders[name];
    if (s == undefined) throw new Error('Unknown shader: ' + name);
    this.shader.set(s);
  }

  public setTexture(name: string, tex: Texture) {
    this.getTextureValue(name).set(tex);
  }

  public getTextureValue(name: string): StateValue<Texture> {
    const t = this.texturesIndex[name];
    if (t == undefined) throw new Error('Invalid sampler name: ' + name);
    return this.textures[t];
  }

  public setIndexBuffer(b: IndexBuffer) {
    this.indexBuffer.set(b);
  }

  public setVertexBuffer(name: string, b: VertexBuffer) {
    this.getVertexBufferValue(name).set(b);
  }

  public getVertexBufferValue(name: string): StateValue<VertexBuffer> {
    let idx = this.vertexBufferIndex[name];
    if (idx == undefined) {
      idx = this.vertexBuffers.length;
      this.vertexBufferIndex[name] = idx;
      this.vertexBufferNames[idx] = name;
      this.vertexBuffers.push(new StateValue<VertexBuffer>(null));
    }
    return this.vertexBuffers[idx];
  }

  public setDrawElements(ptr: Pointer) {
    this.drawElements.set(ptr);
  }

  private rebindShader(gl: WebGLRenderingContext): boolean {
    if (this.shader.changed) {
      const shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      const samplers = this.shader.get().getSamplers();
      this.currentTexturesIdxs.clear();
      for (let s = 0; s < samplers.length; s++) {
        const sampler = samplers[s];
        this.currentTexturesIdxs.push(this.texturesIndex[sampler.name]);
        this.setUniform(sampler.name, s);
      }
      this.currentUniformIdxs.clear();
      const uniforms = this.shader.get().getUniforms();
      for (let u = 0; u < uniforms.length; u++) {
        const uniform = uniforms[u];
        this.currentUniformIdxs.push(this.uniformsIndex[uniform.name]);
      }
      this.shader.changed = false;
      return true;
    }
    return false;
  }

  private rebindVertexBuffers(gl: WebGLRenderingContext, rebindAll: boolean) {
    const shader = this.shader.get();
    for (let a = 0; a < this.vertexBuffers.length; a++) {
      const buf = this.vertexBuffers[a];
      if (!rebindAll && !buf.changed) continue;
      const vbuf = buf.get();
      const location = shader.getAttributeLocation(this.vertexBufferNames[a], gl);
      if (location == -1)
        continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, vbuf.getSpacing(), vbuf.getType(), vbuf.getNormalized(), vbuf.getStride(), vbuf.getOffset());
      buf.changed = false;
    }
  }

  private rebindIndexBuffer(gl: WebGLRenderingContext, rebindAll: boolean) {
    if (rebindAll || this.indexBuffer.changed) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
      this.indexBuffer.changed = false;
    }
  }

  private rebindTextures(gl: WebGLRenderingContext, rebindAll: boolean) {
    const texturesIdxs = this.currentTexturesIdxs;
    const len = texturesIdxs.length();
    for (let s = 0; s < len; s++) {
      const idx = texturesIdxs.get(s);
      const texture = this.textures[idx];
      if (texture != undefined && texture.get() != null && (rebindAll || texture.changed)) {
        gl.activeTexture(gl.TEXTURE0 + s);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
        texture.changed = false;
      }
    }
  }

  private updateUniforms(gl: WebGLRenderingContext, rebindAll: boolean) {
    const uniformsIdxs = this.currentUniformIdxs;
    const len = uniformsIdxs.length();
    for (let u = 0; u < len; u++) {
      const idx = uniformsIdxs.get(u);
      const state = this.uniforms[idx];
      if (!rebindAll && !state.changed) continue;
      SHADER.setUniform(gl, this.shader.get(), this.uniformsDefinitions[idx], state.get());
      state.changed = false;
    }
  }

  public draw(gl: WebGLRenderingContext, mode: number = gl.TRIANGLES) {
    const rebindAll = this.rebindShader(gl);
    this.rebindVertexBuffers(gl, rebindAll);
    this.rebindIndexBuffer(gl, rebindAll);
    this.updateUniforms(gl, rebindAll);
    this.rebindTextures(gl, rebindAll);
    const drawElements = this.drawElements.get();
    drawElements.buffer.update(gl);
    const count = drawElements.idx.size;
    const offset = drawElements.idx.offset;
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, offset * 2);
  }
}