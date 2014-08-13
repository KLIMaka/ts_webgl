import Set = require('../libs/set');

export class Shader {

  private program:WebGLProgram;
  private uniforms = {};
  private attribs = {};
  private uniformNames:string[]; 
  private attributeNames:string[]; 
  private samplers:string[]; 

  constructor(gl:WebGLRenderingContext, prog:WebGLProgram, params:any) {
    this.program = prog;
    this.uniformNames = params.uniforms.values();
    this.attributeNames = params.attributes.values();
    this.samplers = params.samplers.values();
    this.initUniformLocations(gl);
    this.initAttributeLocations(gl);
  }

  private initUniformLocations(gl:WebGLRenderingContext):void {
    for (var i in this.uniformNames) {
      var uniform = this.uniformNames[i];
      this.uniforms[uniform] = gl.getUniformLocation(this.program, uniform);
    }
  }

  private initAttributeLocations(gl:WebGLRenderingContext):void {
    for (var i in this.attributeNames) {
      var attrib = this.attributeNames[i];
      this.attribs[attrib] = gl.getAttribLocation(this.program, attrib);
    }
  }

  public getUniformLocation(name:string, gl:WebGLRenderingContext):WebGLUniformLocation {
    return this.uniforms[name];
  }

  public getAttributeLocation(name:string, gl:WebGLRenderingContext):number {
    return this.attribs[name];
  }

  public getProgram():WebGLProgram {
    return this.program;
  }

  public getUniforms():string[] {
    return this.uniformNames;
  }

  public getAttributes():string[] {
    return this.attributeNames;
  }

  public getSamplers():string[] {
    return this.samplers;
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

  var params = processShaders(vertexSrc, fragmentSrc);

  var program = gl.createProgram();
  gl.attachShader(program, compileSource(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compileSource(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw 'link error: ' + gl.getProgramInfoLog(program);
  }

  return new Shader(gl, program, params);
}

function processLine(line:string, params:any):any {
  var m = line.match(/uniform +[a-zA-Z0-9_]+ +([a-zA-Z0-9_]+)/);
  if (m != null)
    params.uniforms.add(m[1]);
  m = line.match(/attribute +[a-zA-Z0-9_]+ +([a-zA-Z0-9_]+)/);
  if (m != null)
    params.attributes.add(m[1]);
  m = line.match(/uniform sampler2D +([a-zA-Z0-9_]+)/);
  if (m != null)
    params.samplers.add(m[1]);
}

function createParams():any {
  var params:any = {};
  params.uniforms = Set.create<string>();
  params.attributes = Set.create<string>();
  params.samplers = Set.create<string>();
  return params;
}

function processShaders(vsh:string, fsh:string):any {
  var params = createParams();
  var shaders = [vsh, fsh];
  for (var i in shaders) {
    var shader = shaders[i];
    var lines = shader.split("\n");
    for (var l in lines) {
      var line = lines[l];
      processLine(line, params);
    }
  }
  return params;
}