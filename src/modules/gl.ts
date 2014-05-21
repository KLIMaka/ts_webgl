/// <reference path="../defs/webgl.d.ts"/>
import shaders = require('shader');
import DS = require('drawstruct');

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

export class UniformBinder {

  private resolvers:{[index:string]: ()=>any;} = {};
  private setters  :{[index:string]: UniformSetter;} = {};

  public bind(gl:WebGLRenderingContext, shader:shaders.Shader):void {
    gl.useProgram(shader.getProgram());
    var uniforms = shader.getUniforms();
    for (var i = 0; i < uniforms.length; i++) {
      var uniform = uniforms[i];
      var value = this.resolvers[uniform]();
      this.setters[uniform].setUniform(gl, shader.getUniformLocation(uniform, gl), value);
    }
  }

  public addResolver(name:string, setter:UniformSetter, resolver:()=>any) {
    this.setters[name] = setter;
    this.resolvers[name] = resolver;
  }
}

export function draw(gl:WebGLRenderingContext, model:DS.DrawStruct, shader:shaders.Shader) {
  var attributes = model.getAttributes();
  for (var i in  attributes) {
    var attr = attributes[i];
    var buf = model.getVertexBuffer(attr);
    var location = shader.getAttributeLocation(attr, gl);
    if (location != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
    }
  }

  if (model.getIndexBuffer() == null) {
    gl.drawArrays(model.getMode(), model.getOffset(), model.getLength());
  } else {
    var idxBuf = model.getIndexBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
    gl.drawElements(model.getMode(), model.getLength(), idxBuf.getType(), model.getOffset());
  }
}

var pixel = new Uint8Array(4);
export function readId(gl:WebGLRenderingContext, x:number, y:number):number {
  gl.readPixels(x ,gl.drawingBufferHeight-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1]<<8 | pixel[2]<<16 | pixel[3]<<24;
}

