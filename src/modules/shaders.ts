import * as Set from '../libs/set';
import * as DS from './drawstruct';
import * as getter from '../libs/getter';
import * as AB from '../libs/asyncbarrier';

var defaultFSH = 'void main(){gl_FragColor = vec4(0.0);}';
var defaultVSH = 'void main(){gl_Position = vec4(0.0);}';
var defaultProgram:WebGLProgram = null;

export class Shader implements DS.Shader {

  private program:WebGLProgram;
  private uniforms = {};
  private attribs = {};
  private definitions:Definitions = new Definitions();
  private initCallback:(Shader)=>void

  constructor(prog:WebGLProgram, initCallback:(Shader)=>void=null) {
    this.program = prog;
    this.initCallback = initCallback;
  }

  public init(gl:WebGLRenderingContext, prog:WebGLProgram, defs:Definitions):void {
    this.program = prog;
    this.definitions = defs;
    this.initUniformLocations(gl);
    this.initAttributeLocations(gl);
    if (this.initCallback != null)
      this.initCallback(this);
  }

  private initUniformLocations(gl:WebGLRenderingContext):void {
    for (var i in this.definitions.uniforms) {
      var uniform = this.definitions.uniforms[i];
      this.uniforms[uniform.getName()] = gl.getUniformLocation(this.program, uniform.getName());
    }
  }

  private initAttributeLocations(gl:WebGLRenderingContext):void {
    for (var i in this.definitions.attributes) {
      var attrib = this.definitions.attributes[i];
      this.attribs[attrib.getName()] = gl.getAttribLocation(this.program, attrib.getName());
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

  public getUniforms():{[index:string]:DS.Definition} {
    return this.definitions.uniforms;
  }

  public getAttributes():{[index:string]:DS.Definition} {
    return this.definitions.attributes;
  }

  public getSamplers():{[index:string]:DS.Definition} {
    return this.definitions.samplers;
  }
}

var cache:{[index:string]:Shader} = {};

export function createShader(gl:WebGLRenderingContext, name:string, defines:string[]=[], initCallback:(Shader)=>void=null):Shader {
  // var shader = cache[name];
  // if (shader != undefined)
  //   return shader;

  if (defaultProgram == null) {
    defaultProgram = compileProgram(gl, defaultVSH, defaultFSH);
  }

  var shader = new Shader(defaultProgram, initCallback);
  var barrier = AB.create();
  var deftext = prepareDefines(defines);
  getter.preloadString(name+'.vsh', barrier.callback('vsh'));
  getter.preloadString(name+'.fsh', barrier.callback('fsh'));
  barrier.wait((res) => {initShader(gl, shader, deftext+res.vsh, deftext+res.fsh)});
  cache[name] = shader;
  return shader;
}

export function createShaderFromSrc(gl:WebGLRenderingContext, vsh:string, fsh:string):Shader {
  var shader = new Shader(compileProgram(gl, vsh, fsh));
  initShader(gl, shader, vsh, fsh);
  return shader;
}

function initShader(gl:WebGLRenderingContext, shader:Shader, vsh:string, fsh:string) {
  var barrier = AB.create();
  preprocess(vsh, barrier.callback('vsh'));
  preprocess(fsh, barrier.callback('fsh'));
  barrier.wait((res) => {
    var program = compileProgram(gl, res.vsh, res.fsh);
    var defs = processShaders(res.vsh, res.fsh);
    shader.init(gl, program, defs);
  });
}

function prepareDefines(defines:string[]):string {
  var result = '';
  for (var i = 0; i < defines.length; i++) {
    result += "#define " + defines[i] + ";\n";
  }
  return result;
}

function compileProgram(gl:WebGLRenderingContext, vsh:string, fsh:string):WebGLProgram {
  var program = gl.createProgram();
  gl.attachShader(program, compileSource(gl, gl.VERTEX_SHADER, vsh));
  gl.attachShader(program, compileSource(gl, gl.FRAGMENT_SHADER, fsh));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw 'link error: ' + gl.getProgramInfoLog(program);
  }
  return program;
}

function compileSource(gl:WebGLRenderingContext, type:number, source:string):WebGLShader {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw 'compile error: ' + gl.getShaderInfoLog(shader) + '\nin source:\n'+source;
  }
  return shader;
}

function processLine(line:string, defs:Definitions) {
  var m = line.match(/^uniform +([a-zA-Z0-9_]+) +([a-zA-Z0-9_]+)/);
  if (m != null)
    defs.uniforms[m[2]] = new DefinitionImpl(m[1], m[2]);
  m = line.match(/^attribute +([a-zA-Z0-9_]+) +([a-zA-Z0-9_]+)/);
  if (m != null)
    defs.attributes[m[2]] = new DefinitionImpl(m[1], m[2]);
  m = line.match(/^uniform +(sampler2D) +([a-zA-Z0-9_]+)/);
  if (m != null)
    defs.samplers[m[2]] = new DefinitionImpl(m[1], m[2]);
}

export class DefinitionImpl implements DS.Definition {
  constructor(
    private type:string,
    private name:string
  ){}

  getName() {return this.name}
  getType() {return this.type}
}

export class Definitions{
  public uniforms:{[index:string]:DefinitionImpl} = {};
  public attributes:{[index:string]:DefinitionImpl} = {};
  public samplers:{[index:string]:DefinitionImpl} = {};
}


function processShaders(vsh:string, fsh:string):any {
  var defs = new Definitions();
  var shaders = [vsh, fsh];
  for (var i in shaders) {
    var shader = shaders[i];
    var lines = shader.split("\n");
    for (var l in lines) {
      var line = lines[l];
      processLine(line, defs);
    }
  }
  return defs;
}

function preprocess(shader:string, cb:(sh:string)=>void):void {
  var lines = shader.split("\n");
  var barrier = AB.create();
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var m = l.match(/^#include +"([^"]+)"/);
    if (m != null) {
      getter.preloadString(m[1], barrier.callback(i+''));
    }
  }
  barrier.wait((incs) => {
    var res = [];
    for (var i = 0 ; i < lines.length; i++) {
      var inc = incs[i+''];
      res.push(inc == undefined ? lines[i] : inc);
    }
    cb(res.join("\n"));
  });
}

var setters = {
  mat4 : (gl:WebGLRenderingContext, loc, val) => gl.uniformMatrix4fv(loc, false, val),
  ivec2 : (gl:WebGLRenderingContext, loc, val) => gl.uniform2iv(loc, val),
  vec2 : (gl:WebGLRenderingContext, loc, val) => gl.uniform2fv(loc, val),
  vec3 : (gl:WebGLRenderingContext, loc, val) => gl.uniform3fv(loc, val),
  vec4 : (gl:WebGLRenderingContext, loc, val) => gl.uniform4fv(loc, val),
  int : (gl:WebGLRenderingContext, loc, val) => gl.uniform1i(loc, val),
  float : (gl:WebGLRenderingContext, loc, val) => gl.uniform1f(loc, val),
  sampler2D : (gl:WebGLRenderingContext, loc, val) => gl.uniform1i(loc, val),
}

export function setUniform(gl:WebGLRenderingContext, shader:DS.Shader, name:string, value) {
  var uniform = shader.getUniforms()[name];
  if (uniform == undefined)
    return;
  var loc = shader.getUniformLocation(name, gl);
  var setter = setters[uniform.getType()];
  if (setter == undefined)
    throw new Error('Invalid type: ' + uniform.getType());
  setter(gl, loc, value);
}
