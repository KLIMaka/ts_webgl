
export class Shader {

  private program:WebGLProgram;
  private uniforms = {};
  private attribs = {};
  private uniforms_names:string[]; 

  constructor(prog:WebGLProgram, uniforms:string[]) {
    this.program = prog;
    this.uniforms_names = uniforms;
  }

  public getUniformLocation(name:string, gl:WebGLRenderingContext):WebGLUniformLocation {
    var location = this.uniforms[name];
    if(location == undefined) {
      location = gl.getUniformLocation(this.program, name);
      this.uniforms[name] = location;
    }
    return location;
  }

  public getAttributeLocation(name:string, gl:WebGLRenderingContext):number {
    var location = this.attribs[name];
    if(location == undefined) {
      location = gl.getAttribLocation(this.program, name);
      this.attribs[name] = location;
    }
    return location;
  }

  public getProgram():WebGLProgram {
    return this.program;
  }

  public getUniforms():string[] {
    return this.uniforms_names;
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

  var uniforms = processShaders(vertexSrc, fragmentSrc);

  var program = gl.createProgram();
  gl.attachShader(program, compileSource(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compileSource(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw 'link error: ' + gl.getProgramInfoLog(program);
  }

  return new Shader(program, uniforms);
}

function processShaders(vsh:string, fsh:string):string[] {
  var uniforms:string[] = [];
  var shaders = [vsh, fsh];
  for (var i in shaders) {
    var shader = shaders[i];
    var lines = shader.split("\r?\n");
    for (var l in lines) {
      var line = lines[l];
      var m = line.match(/uniform +[a-zA-Z0-9_]+ +([a-zA-Z0-9_]+)/);
      if (m == null) continue;
      var name = m[1];
      if (uniforms.indexOf(name) == -1)
        uniforms.push(name);
    }
  }
  return uniforms;
}