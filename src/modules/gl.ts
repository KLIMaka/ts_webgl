import * as DS from './drawstruct';
import * as BATCH from './batcher';

export function createContextFromCanvas(id: string, opts = {}): WebGLRenderingContext {
  let canvas = <HTMLCanvasElement>document.getElementById(id);
  let gl = <WebGLRenderingContext>canvas.getContext('webgl', opts);
  return gl;
}

export function createContext(w: number, h: number, opts = {}): WebGLRenderingContext {
  let canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.id = 'gl';
  let gl = <WebGLRenderingContext>canvas.getContext('webgl', opts);

  document.body.appendChild(canvas);
  document.body.style.overflow = 'hidden';
  canvas.style.position = 'absolute';
  return gl;
}

function resize(gl: WebGLRenderingContext) {
  let canvas = <HTMLCanvasElement>gl.canvas;

  let displayWidth = canvas.clientWidth;
  let displayHeight = canvas.clientHeight;

  if (canvas.width != displayWidth || canvas.height != displayHeight) {

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

export function animate(gl: WebGLRenderingContext, callback: (gl: WebGLRenderingContext, time: number) => void) {
  let time = new Date().getTime();

  function update() {
    resize(gl);
    let now = new Date().getTime();
    callback(gl, (now - time) / 1000);
    requestAnimationFrame(update);
    time = now;
  }

  update();
}

export interface UniformSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void;
}

export class UniformMatrix4fvSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void {
    gl.uniformMatrix4fv(location, false, value);
  }
}
export let mat4Setter = new UniformMatrix4fvSetter();

export class Uniform3fvSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void {
    gl.uniform3fv(location, value);
  }
}
export let vec3Setter = new Uniform3fvSetter();

export class Uniform4fvSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void {
    gl.uniform4fv(location, value);
  }
}
export let vec4Setter = new Uniform4fvSetter();

export class UniformIntSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void {
    gl.uniform1i(location, value);
  }
}
export let int1Setter = new UniformIntSetter();

export class UniformFloatSetter {
  setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, value: any): void {
    gl.uniform1f(location, value);
  }
}
export let float1Setter = new UniformFloatSetter();

export class UniformBinder {

  private resolvers: { [index: string]: () => any; } = {};
  private setters: { [index: string]: UniformSetter; } = {};

  public bind(gl: WebGLRenderingContext, shader: DS.Shader): void {
    let uniforms = shader.getUniforms();
    for (let i in uniforms) {
      let uniform = uniforms[i];
      if (this.resolvers[uniform.getName()] == undefined)
        continue;
      let loc = shader.getUniformLocation(uniform.getName(), gl)
      if (!loc)
        continue;
      let value = this.resolvers[uniform.getName()]();
      this.setters[uniform.getName()].setUniform(gl, loc, value);
    }
  }

  public addResolver(name: string, setter: UniformSetter, resolver: () => any) {
    this.setters[name] = setter;
    this.resolvers[name] = resolver;
  }
}

export function binder(resolvers: any): UniformBinder {
  let binder = new UniformBinder();
  for (let i = 0; i < resolvers.length; i++) {
    let r = resolvers[i];
    binder.addResolver(r[0], r[1], r[2]);
  }
  return binder;
}


function globalUniforms(gl: WebGLRenderingContext, shader: DS.Shader, globalBinder: UniformBinder): DS.Shader {
  globalBinder.bind(gl, shader);
  return shader;
}

function drawModel(gl: WebGLRenderingContext, shader: DS.Shader, model: DS.DrawStruct): DS.Shader {
  let samplers = shader.getSamplers();
  let unit = 0;
  for (let s in samplers) {
    let sampler = samplers[s];
    gl.activeTexture(gl.TEXTURE0 + unit++);
    gl.bindTexture(gl.TEXTURE_2D, model.getMaterial().getTexture(sampler.getName()).get());
  }
  gl.drawElements(model.getMode(), model.getLength(), gl.UNSIGNED_SHORT, model.getOffset());
  return shader;
}

function initTextures(gl: WebGLRenderingContext, shader: DS.Shader, data: any): DS.Shader {
  let samplers = shader.getSamplers();
  let unit = 0;
  for (let s in samplers) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    let sampler = samplers[s];
    gl.uniform1i(shader.getUniformLocation(sampler.getName(), gl), unit++);
  }
  return shader;
}

export function draw(gl: WebGLRenderingContext, models: DS.DrawStruct[], globalBinder: UniformBinder) {
  let cmds = [];
  let curshader: DS.Shader = null;
  for (let m = 0; m < models.length; m++) {
    let model = models[m];
    if (curshader != model.getMaterial().getShader()) {
      cmds.push(BATCH.shader, model.getMaterial().getShader());
      cmds.push(BATCH.vertexBuffers, model.getVertexBuffers());
      cmds.push(BATCH.indexBuffer, model.getIndexBuffer());
      cmds.push(globalUniforms, globalBinder);
      cmds.push(initTextures, null);
      curshader = model.getMaterial().getShader();
    }
    cmds.push(drawModel, models[m]);
  }
  new BATCH.exec(cmds, gl);
}

let pixel = new Uint8Array(4);
export function readId(gl: WebGLRenderingContext, x: number, y: number): number {
  gl.readPixels(x, gl.drawingBufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1] << 8 | pixel[2] << 16 /*| pixel[3]<<24*/;
}

