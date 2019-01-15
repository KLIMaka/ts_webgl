import DS = require('./drawstruct');
import BATCH = require('./batcher');

export function createContext(w:number, h:number, opts = {}):WebGLRenderingContext {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.id = 'gl';
  var gl = <WebGLRenderingContext> canvas.getContext('webgl', opts);

  document.body.appendChild(gl.canvas);
  document.body.style.overflow = 'hidden';
  gl.canvas.style.position = 'absolute';
  return gl;
}

function resize(gl:WebGLRenderingContext) {
  var canvas = gl.canvas;
 
  var displayWidth  = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;
 
  if (canvas.width  != displayWidth ||  canvas.height != displayHeight) {
 
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
 
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

export function animate(gl:WebGLRenderingContext, callback:(gl:WebGLRenderingContext, time:number)=>void) {
  var time = new Date().getTime();

  function update() {
    resize(gl);
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


function globalUniforms(gl:WebGLRenderingContext, shader:DS.Shader, globalBinder:UniformBinder):DS.Shader {
  globalBinder.bind(gl, shader);
  return shader;
}

function drawModel(gl:WebGLRenderingContext, shader:DS.Shader, model:DS.DrawStruct):DS.Shader {
  var samplers = shader.getSamplers();
  for (var unit = 0; unit < samplers.length; unit++) {
    var sampler = samplers[unit];
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, model.getMaterial().getTexture(sampler).get());
  }
  gl.drawElements(model.getMode(), model.getLength(), gl.UNSIGNED_SHORT, model.getOffset());
  return shader;
}

function initTextures(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  var samplers = shader.getSamplers();
  for (var unit = 0; unit < samplers.length; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    var sampler = samplers[unit];
    gl.uniform1i(shader.getUniformLocation(sampler, gl), unit);
  }
  return shader;
}

export function draw(gl:WebGLRenderingContext, models:DS.DrawStruct[], globalBinder:UniformBinder) {
  var cmds = [];
  var curshader:DS.Shader = null;
  for (var m = 0; m < models.length; m++) {
    var model = models[m];
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

var pixel = new Uint8Array(4);
export function readId(gl:WebGLRenderingContext, x:number, y:number):number {
  gl.readPixels(x ,gl.drawingBufferHeight-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1]<<8 | pixel[2]<<16 /*| pixel[3]<<24*/;
}

