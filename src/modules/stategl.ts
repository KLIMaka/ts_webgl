import * as GLM from '../libs_js/glmatrix';
import { Pointer } from './buffergl';
import { Deck } from './collections';
import { Definition, IndexBuffer, Shader, Texture, VertexBuffer } from './drawstruct';
import * as SHADER from './shaders';

function eqCmp<T>(lh: T, rh: T) { return lh === rh }
function assign<T>(dst: T, src: T) { return src }

export class StateValue<T> {
  constructor(
    private changecb: () => void,
    public value: T,
    public cmp: (lh: T, rh: T) => boolean = eqCmp,
    public setter: (dst: T, src: T) => T = assign
  ) { }
  get(): T { return this.value; }
  set(v: T) {
    if (!this.cmp(v, this.value)) {
      this.value = this.setter(this.value, v);
      this.changecb()
    }
  }
}

function createStateValue(type: string, changecb: () => void): StateValue<any> {
  switch (type) {
    case "mat4":
    case "vec3":
    case "vec4":
      return new StateValue<GLM.Mat4Array>(changecb, GLM[type].create(), GLM[type].exactEquals, GLM[type].copy)
    default:
      return new StateValue<number>(changecb, 0);
  }
}

export class State {
  private shader: StateValue<Shader> = new StateValue<Shader>(() => this.changeShader = true, null);
  private indexBuffer: StateValue<IndexBuffer> = new StateValue<IndexBuffer>(() => this.changeShader = true, null);
  private drawElements: Pointer;
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

  private changeShader = true;
  private changeIndexBuffer = true;
  private changedVertexBuffersIds = new Deck<number>();
  private changedTextures = new Deck<[number, number]>();
  private changedUniformIdxs = new Deck<number>();

  private batchOffset = -1;
  private batchSize = -1;
  private batchMode = -1;


  public flush(gl: WebGLRenderingContext) {
    if (this.batchMode == -1) return;
    this.drawElements.buffer.update(gl);
    gl.drawElements(this.batchMode, this.batchSize, gl.UNSIGNED_SHORT, this.batchOffset * 2);
    this.batchMode = -1;
  }

  private tryBatch(gl: WebGLRenderingContext, mode: number) {
    if (this.batchMode == -1) {
      this.batchMode = mode;
      this.batchOffset = this.drawElements.idx.offset;
      this.batchSize = this.drawElements.idx.size;
      return;
    } else if (this.batchMode == mode
      && !this.changeShader
      && !this.changeIndexBuffer
      && this.changedUniformIdxs.isEmpty()
      && this.changedTextures.isEmpty()
      && this.changedVertexBuffersIds.isEmpty()) {
      const offset = this.drawElements.idx.offset;
      const size = this.drawElements.idx.size;
      if (this.batchOffset == offset + size) {
        this.batchOffset = offset;
        this.batchSize += size;
        return;
      } else if (this.batchOffset + this.batchSize == offset) {
        this.batchSize += size;
        return;
      }
    }
    this.flush(gl);
    this.tryBatch(gl, mode);
  }


  public registerShader(name: string, shader: Shader) {
    this.shaders[name] = shader;
    const uniforms = shader.getUniforms();
    for (let u = 0; u < uniforms.length; u++) {
      const uniform = uniforms[u];
      if (this.uniformsIndex[uniform.name] != undefined) continue;
      const idx = this.uniforms.length;
      this.uniforms.push(createStateValue(uniform.type, () => this.changedUniformIdxs.push(idx)));
      this.uniformsDefinitions.push(uniform);
      this.uniformsIndex[uniform.name] = idx;
    }
    const samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      if (this.texturesIndex[sampler.name] != undefined) continue;
      const idx = this.textures.length;
      this.textures.push(new StateValue<Texture>(() => this.changedTextures.push([idx, s]), null));
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
      this.vertexBuffers.push(new StateValue<VertexBuffer>(() => this.changedVertexBuffersIds.push(idx), null));
    }
    return this.vertexBuffers[idx];
  }

  public setDrawElements(ptr: Pointer) {
    this.drawElements = ptr;
  }

  private rebindShader(gl: WebGLRenderingContext) {
    if (this.changeShader) {
      const shader = this.shader.get();
      gl.useProgram(shader.getProgram());
      const samplers = this.shader.get().getSamplers();
      this.changedTextures.clear();
      for (let s = 0; s < samplers.length; s++) {
        const sampler = samplers[s];
        this.changedTextures.push([this.texturesIndex[sampler.name], s]);
        this.setUniform(sampler.name, s);
      }
      this.changedUniformIdxs.clear();
      const uniforms = this.shader.get().getUniforms();
      for (let u = 0; u < uniforms.length; u++) {
        const uniform = uniforms[u];
        this.changedUniformIdxs.push(this.uniformsIndex[uniform.name]);
      }
      const attribs = this.shader.get().getAttributes();
      for (let a = 0; a < attribs.length; a++) {
        const attrib = attribs[a];
        this.changedVertexBuffersIds.push(this.vertexBufferIndex[attrib.name]);
      }
      this.changeShader = false;
      this.changeIndexBuffer = true;
    }
  }

  private rebindVertexBuffers(gl: WebGLRenderingContext) {
    const vertexBufferIdxs = this.changedVertexBuffersIds;
    const len = vertexBufferIdxs.length();
    const shader = this.shader.get();
    for (let a = 0; a < len; a++) {
      const idx = vertexBufferIdxs.get(a);
      const buf = this.vertexBuffers[idx];
      const vbuf = buf.get();
      const location = shader.getAttributeLocation(this.vertexBufferNames[idx], gl);
      if (location == -1)
        continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, vbuf.getSpacing(), vbuf.getType(), vbuf.getNormalized(), vbuf.getStride(), vbuf.getOffset());
    }
    vertexBufferIdxs.clear();
  }

  private rebindIndexBuffer(gl: WebGLRenderingContext) {
    if (this.changeIndexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
      this.changeIndexBuffer = false;
    }
  }

  private rebindTextures(gl: WebGLRenderingContext) {
    const textures = this.changedTextures;
    const len = textures.length();
    for (let t = 0; t < len; t++) {
      const [idx, sampler] = textures.get(t);
      const texture = this.textures[idx];
      if (texture != undefined && texture.get() != null) {
        gl.activeTexture(gl.TEXTURE0 + sampler);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
      }
    }
    textures.clear();
  }

  private updateUniforms(gl: WebGLRenderingContext) {
    const uniformsIdxs = this.changedUniformIdxs;
    const len = uniformsIdxs.length();
    for (let u = 0; u < len; u++) {
      const idx = uniformsIdxs.get(u);
      const state = this.uniforms[idx];
      SHADER.setUniform(gl, this.shader.get(), this.uniformsDefinitions[idx], state.get());
    }
    uniformsIdxs.clear();
  }

  public draw(gl: WebGLRenderingContext, mode: number = gl.TRIANGLES) {
    this.tryBatch(gl, mode);
    this.rebindShader(gl);
    this.rebindVertexBuffers(gl);
    this.rebindIndexBuffer(gl);
    this.updateUniforms(gl);
    this.rebindTextures(gl);
  }
}