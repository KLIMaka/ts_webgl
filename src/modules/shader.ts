/// <reference path="../defs/webgl.d.ts" />

export class Shader {

  private program:WebGLProgram;
  private uniforms = {};
  private attribs = {};

  constructor(prog:WebGLProgram) {
    this.program = prog;
  }

  getUniformLocation(name:string, gl:WebGLRenderingContext):WebGLUniformLocation {
    var location = this.uniforms[name];
    if(location == undefined) {
      location = gl.getUniformLocation(this.program, name);
      this.uniforms[name] = location;
    }
    return location;
  }

  getAttributeLocation(name:string, gl:WebGLRenderingContext):number {
    var location = this.attribs[name];
    if(location == undefined) {
      location = gl.getAttribLocation(this.program, name);
      this.attribs[name] = location;
    }
    return location;
  }

  getProgram():WebGLProgram {
    return this.program;
  }
}

export function createShader(gl:WebGLRenderingContext, vertexSrc:string, fragmentSrc:string):Shader {

  function compileSource(type:number, source:string):WebGLShader {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw 'compile error: ' + gl.getShaderInfoLog(shader);
    }
    return shader;
  }

  var program = gl.createProgram();
  gl.attachShader(program, compileSource(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compileSource(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw 'link error: ' + gl.getProgramInfoLog(program);
  }

  return new Shader(program);
}