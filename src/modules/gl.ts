import DS = require('./drawstruct');
import BATCH = require('./batcher');

export function createContext(w:number, h:number, opts = {}):WebGLRenderingContext {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var gl = canvas.getContext('webgl', opts);

  document.body.appendChild(gl.canvas);
  document.body.style.overflow = 'hidden';
  gl.canvas.style.position = 'absolute';
  return gl;
}

export function animate(gl:WebGLRenderingContext, callback:(gl:WebGLRenderingContext, time:number)=>void) {
  var time = new Date().getTime();

  function update() {
    var now = new Date().getTime();
    callback(gl, (now - time) / 1000);
    requestAnimationFrame(update);
    time = now;
  }

  update();
}

export interface UniformSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void;
}

export class UniformMatrix4fvSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniformMatrix4fv(location, false, value);
  }
}
export var mat4Setter = new UniformMatrix4fvSetter();

export class Uniform3fvSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniform3fv(location, value);
  }
}
export var vec3Setter = new Uniform3fvSetter();

export class Uniform4fvSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniform4fv(location, value);
  }
}
export var vec4Setter = new Uniform4fvSetter();

export class UniformIntSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniform1i(location, value);
  }
}
export var int1Setter = new UniformIntSetter();

export class UniformFloatSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniform1f(location, value);
  }
}
export var float1Setter = new UniformFloatSetter();

export class UniformBinder {

  private resolvers:{[index:string]: ()=>any;} = {};
  private setters  :{[index:string]: UniformSetter;} = {};

  public bind(gl:WebGLRenderingContext, shader:DS.Shader):void {
    var uniforms = shader.getUniforms();
    for (var i = 0; i < uniforms.length; i++) {
      var uniform = uniforms[i];
      if (this.resolvers[uniform] == undefined)
        continue;
      var loc = shader.getUniformLocation(uniform, gl)
      if (!loc)
        continue;
      var value = this.resolvers[uniform]();
      this.setters[uniform].setUniform(gl, loc, value);
    }
  }

  public addResolver(name:string, setter:UniformSetter, resolver:()=>any) {
    this.setters[name] = setter;
    this.resolvers[name] = resolver;
  }
}

export function binder(resolvers:any):UniformBinder {
  var binder = new UniformBinder();
  for (var i = 0; i < resolvers.length; i++) {
    var r = resolvers[i];
    binder.addResolver(r[0], r[1], r[2]);
  }
  return binder;
}

var batcher = new BATCH.BatchState();

class Shader extends BATCH.Shader {
  constructor(private shader:DS.Shader) {super()}
  get():DS.Shader {
    return this.shader;
  }
}

class VertexBuffers extends BATCH.VertexBuffers {
  constructor(private model:DS.DrawStruct) {super()}
  get(attr:string):DS.VertexBuffer {
    return this.model.getVertexBuffer(attr);
  }
}

class IndexBuffer extends BATCH.IndexBuffer {
  constructor(private model:DS.DrawStruct) {super()}
  get():DS.IndexBuffer {
    return this.model.getIndexBuffer();
  }
}

class GlobalUniforms extends BATCH.Uniforms {
  constructor(private globalBinder:UniformBinder) {super()}
  bind(shader:DS.Shader, gl:WebGLRenderingContext):void {
    return this.globalBinder.bind(gl, shader);
  }
}

class TextureUniforms extends BATCH.Uniforms {
  constructor(private model:DS.DrawStruct) {super()}
  bind(shader:DS.Shader, gl:WebGLRenderingContext):void {
    var samplers = shader.getSamplers();
    for (var unit = 0; unit < samplers.length; unit++) {
      var sampler = samplers[unit];
      gl.bindTexture(gl.TEXTURE_2D, this.model.getMaterial().getTexture(sampler).get());
    }
  }
}

class InitTextures extends BATCH.Uniforms {
  constructor() {super()}
  bind(shader:DS.Shader, gl:WebGLRenderingContext):void {
    var samplers = shader.getSamplers();
    for (var unit = 0; unit < samplers.length; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      var sampler = samplers[unit];
      gl.uniform1i(shader.getUniformLocation(sampler, gl), unit);
    }
  }
}

class DrawCall extends BATCH.DrawCall {
  constructor(private model:DS.DrawStruct) {super()}
  call(gl:WebGLRenderingContext):void {
    var model = this.model;
    gl.drawElements(model.getMode(), model.getLength(), gl.UNSIGNED_SHORT, model.getOffset());
  }
}

export function draw(gl:WebGLRenderingContext, models:DS.DrawStruct[], globalBinder:UniformBinder) {
  var cmds:BATCH.Command[] = [];
  cmds.push(new Shader(models[0].getMaterial().getShader()));
  cmds.push(new VertexBuffers(models[0]));
  cmds.push(new IndexBuffer(models[0]));
  cmds.push(new GlobalUniforms(globalBinder));
  cmds.push(new InitTextures());
  for (var m = 0; m < models.length; m++) {
    var model = models[m];
    cmds.push(new TextureUniforms(model));
    cmds.push(new DrawCall(model));
  }
  batcher.exec(cmds, gl);
}

var pixel = new Uint8Array(4);
export function readId(gl:WebGLRenderingContext, x:number, y:number):number {
  gl.readPixels(x ,gl.drawingBufferHeight-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1]<<8 | pixel[2]<<16 /*| pixel[3]<<24*/;
}

