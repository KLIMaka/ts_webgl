import shaders = require('shaders');
import materials = require('materials');
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

export class UniformIntSetter {
  setUniform(gl:WebGLRenderingContext, location:WebGLUniformLocation, value:any):void {
    gl.uniform1i(location, value);
  }
}
export var int1Setter = new UniformIntSetter();

export class UniformBinder {

  private resolvers:{[index:string]: ()=>any;} = {};
  private setters  :{[index:string]: UniformSetter;} = {};

  public bind(gl:WebGLRenderingContext, shader:DS.Shader):void {
    var uniforms = shader.getUniforms();
    for (var i = 0; i < uniforms.length; i++) {
      var uniform = uniforms[i];
      if (this.resolvers[uniform] == undefined)
        continue;
      var value = this.resolvers[uniform]();
      this.setters[uniform].setUniform(gl, shader.getUniformLocation(uniform, gl), value);
    }
  }

  public addResolver(name:string, setter:UniformSetter, resolver:()=>any) {
    this.setters[name] = setter;
    this.resolvers[name] = resolver;
  }
}

export function draw(gl:WebGLRenderingContext, models:DS.DrawStruct[], globalBinder:UniformBinder) {
  for (var m = 0; m < models.length; m++) {
    var model = models[m];
    var material = model.getMaterial();
    var shader = material.getShader();
    if (m == 0) {
      gl.useProgram(shader.getProgram());
      globalBinder.bind(gl, shader);
      var attributes = shader.getAttributes();
      for (var a = 0; a < attributes.length; a++) {
        var attr = attributes[a];
        var buf = model.getVertexBuffer(attr);
        var location = shader.getAttributeLocation(attr, gl);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
      }
      var idxBuf = model.getIndexBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
    }

    var samplers = shader.getSamplers();
    for (var unit = 0; unit < samplers.length; unit++) {
      var sampler = samplers[unit];
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, material.getTexture(sampler).get());
      gl.uniform1i(shader.getUniformLocation(sampler, gl), unit);
    }

    gl.drawElements(model.getMode(), model.getLength(), idxBuf.getType(), model.getOffset());
  }
}

var pixel = new Uint8Array(4);
export function readId(gl:WebGLRenderingContext, x:number, y:number):number {
  gl.readPixels(x ,gl.drawingBufferHeight-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1]<<8 | pixel[2]<<16 /*| pixel[3]<<24*/;
}

