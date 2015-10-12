import Set = require('../libs/set');
import DS = require('drawstruct');
import getter = require('../libs/getter');
import AB = require('../libs/asyncbarrier');

var defaultFSH = 'void main(){gl_FragColor = vec4(0.0);}';
var defaultVSH = 'void main(){gl_Position = vec4(0.0);}';
var defaultProgram:WebGLProgram = null;

export class Shader implements DS.Shader {

  private program:WebGLProgram;
  private uniforms = {};
  private attribs = {};
  private uniformNames:string[] = []; 
  private attributeNames:string[] = []; 
  private samplers:string[] = []; 

  constructor(prog:WebGLProgram) {
    this.program = prog;
  }

  public init(gl:WebGLRenderingContext, prog:WebGLProgram, params:any):void {
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

var cache:{[index:string]:Shader} = {};

export function createShader(gl:WebGLRenderingContext, name:string):Shader {
  var shader = cache[name];
  if (shader != undefined)
    return shader;

  if (defaultProgram == null) {
    defaultProgram = compileProgram(gl, defaultVSH, defaultFSH);
  }

  var shader = new Shader(defaultProgram);
  var barrier = AB.create((res) => {initShader(gl, shader, res.vsh, res.fsh)});
  getter.preloadString(name+'.vsh', barrier.callback('vsh'));
  getter.preloadString(name+'.fsh', barrier.callback('fsh'));
  barrier.wait();
  cache[name] = shader;
  return shader;
}

export function createShaderFromSrc(gl:WebGLRenderingContext, vsh:string, fsh:string):Shader {
  var shader = new Shader(compileProgram(gl, vsh, fsh));
  initShader(gl, shader, vsh, fsh);
  return shader;
}

function initShader(gl:WebGLRenderingContext, shader:Shader, vsh:string, fsh:string) {
  var barrier = AB.create((res) => {
    var program = compileProgram(gl, res.vsh, res.fsh);
    var params = processShaders(res.vsh, res.fsh);
    shader.init(gl, program, params);
  });
  preprocess(vsh, barrier.callback('vsh'));
  preprocess(fsh, barrier.callback('fsh'));
  barrier.wait();
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
    throw 'compile error: ' + gl.getShaderInfoLog(shader);
  }
  return shader;
}

function processLine(line:string, params:any):any {
  var m = line.match(/^uniform +[a-zA-Z0-9_]+ +([a-zA-Z0-9_]+)/);
  if (m != null)
    params.uniforms.add(m[1]);
  m = line.match(/^attribute +[a-zA-Z0-9_]+ +([a-zA-Z0-9_]+)/);
  if (m != null)
    params.attributes.add(m[1]);
  m = line.match(/^uniform sampler2D +([a-zA-Z0-9_]+)/);
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

function preprocess(shader:string, cb:(sh:string)=>void):void {
  var lines = shader.split("\n");
  var barrier = AB.create((incs) => {
    var res = [];
    for (var i = 0 ; i < lines.length; i++) {
      var inc = incs[i+''];
      res.push(inc == undefined ? lines[i] : inc);
    }
    cb(res.join("\n"));
  });
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var m = l.match(/^#include +"([^"]+)"/);
    if (m != null) {
      getter.preloadString(m[1], barrier.callback(i+''));
    }
  }
  barrier.wait();
}
