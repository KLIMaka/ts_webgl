import * as Set from '../libs/set';
import * as DS from './drawstruct';
import * as getter from '../libs/getter';
import * as AB from '../libs/asyncbarrier';

let defaultFSH = 'void main(){gl_FragColor = vec4(0.0);}';
let defaultVSH = 'void main(){gl_Position = vec4(0.0);}';
let defaultProgram: WebGLProgram = null;

export class Shader implements DS.Shader {

  private program: WebGLProgram;
  private uniforms = {};
  private attribs = {};
  private definitions: Definitions = new Definitions();
  private initCallback: (Shader) => void

  constructor(prog: WebGLProgram, initCallback: (Shader) => void = null) {
    this.program = prog;
    this.initCallback = initCallback;
  }

  public init(gl: WebGLRenderingContext, prog: WebGLProgram, defs: Definitions): void {
    this.program = prog;
    this.definitions = defs;
    this.initUniformLocations(gl);
    this.initAttributeLocations(gl);
    if (this.initCallback != null)
      this.initCallback(this);
  }

  private initUniformLocations(gl: WebGLRenderingContext): void {
    for (let i in this.definitions.uniforms) {
      let uniform = this.definitions.uniforms[i];
      this.uniforms[uniform.getName()] = gl.getUniformLocation(this.program, uniform.getName());
    }
  }

  private initAttributeLocations(gl: WebGLRenderingContext): void {
    for (let i in this.definitions.attributes) {
      let attrib = this.definitions.attributes[i];
      this.attribs[attrib.getName()] = gl.getAttribLocation(this.program, attrib.getName());
    }
  }

  public getUniformLocation(name: string, gl: WebGLRenderingContext): WebGLUniformLocation {
    return this.uniforms[name];
  }

  public getAttributeLocation(name: string, gl: WebGLRenderingContext): number {
    return this.attribs[name];
  }

  public getProgram(): WebGLProgram {
    return this.program;
  }

  public getUniforms(): { [index: string]: DS.Definition } {
    return this.definitions.uniforms;
  }

  public getAttributes(): { [index: string]: DS.Definition } {
    return this.definitions.attributes;
  }

  public getSamplers(): { [index: string]: DS.Definition } {
    return this.definitions.samplers;
  }
}

let cache: { [index: string]: Shader } = {};

export function createShader(gl: WebGLRenderingContext, name: string, defines: string[] = [], initCallback: (Shader) => void = null): Shader {
  // let shader = cache[name];
  // if (shader != undefined)
  //   return shader;

  if (defaultProgram == null) {
    defaultProgram = compileProgram(gl, defaultVSH, defaultFSH);
  }

  let shader = new Shader(defaultProgram, initCallback);
  let barrier = AB.create();
  let deftext = prepareDefines(defines);
  getter.preloadString(name + '.vsh', barrier.callback('vsh'));
  getter.preloadString(name + '.fsh', barrier.callback('fsh'));
  barrier.wait((res) => { initShader(gl, shader, deftext + res.vsh, deftext + res.fsh) });
  cache[name] = shader;
  return shader;
}

export function createShaderFromSrc(gl: WebGLRenderingContext, vsh: string, fsh: string): Shader {
  let shader = new Shader(compileProgram(gl, vsh, fsh));
  initShader(gl, shader, vsh, fsh);
  return shader;
}

function initShader(gl: WebGLRenderingContext, shader: Shader, vsh: string, fsh: string) {
  let barrier = AB.create();
  preprocess(vsh, barrier.callback('vsh'));
  preprocess(fsh, barrier.callback('fsh'));
  barrier.wait((res) => {
    let program = compileProgram(gl, res.vsh, res.fsh);
    let defs = processShaders(gl, program);
    shader.init(gl, program, defs);
  });
}

function prepareDefines(defines: string[]): string {
  let result = '';
  for (let i = 0; i < defines.length; i++) {
    result += "#define " + defines[i] + "\n";
  }
  return result;
}

function compileProgram(gl: WebGLRenderingContext, vsh: string, fsh: string): WebGLProgram {
  let program = gl.createProgram();
  gl.attachShader(program, compileSource(gl, gl.VERTEX_SHADER, vsh));
  gl.attachShader(program, compileSource(gl, gl.FRAGMENT_SHADER, fsh));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('link error: ' + gl.getProgramInfoLog(program));
  }
  return program;
}

function compileSource(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('compile error: ' + gl.getShaderInfoLog(shader) + '\nin source:\n' + source);
  }
  return shader;
}

export class DefinitionImpl implements DS.Definition {
  constructor(
    private type: string,
    private name: string
  ) { }

  getName() { return this.name }
  getType() { return this.type }
}

export class Definitions {
  public uniforms: { [index: string]: DefinitionImpl } = {};
  public attributes: { [index: string]: DefinitionImpl } = {};
  public samplers: { [index: string]: DefinitionImpl } = {};
}


function processShaders(gl: WebGLRenderingContext, program: WebGLProgram): any {
  let defs = new Definitions();
  let attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let a = 0; a < attribs; a++) {
    let info = gl.getActiveAttrib(program, a);
    defs.attributes[info.name] = convertToDefinition(info);
  }
  let uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let u = 0; u < uniforms; u++) {
    let info = gl.getActiveUniform(program, u);
    let def = convertToDefinition(info);
    defs.uniforms[info.name] = def;
    if (def.getType() == 'sampler2D')
      defs.samplers[info.name] = def;
  }
  return defs;
}

function convertToDefinition(info: WebGLActiveInfo): DefinitionImpl {
  return new DefinitionImpl(type2String(info.type), info.name);
}

function type2String(type: number): string {
  switch (type) {
    case WebGLRenderingContext.SAMPLER_2D: return "sampler2D";
    case WebGLRenderingContext.INT: return "int";
    case WebGLRenderingContext.FLOAT: return "float";
    case WebGLRenderingContext.FLOAT_MAT4: return "mat4";
    case WebGLRenderingContext.FLOAT_MAT3: return "mat3";
    case WebGLRenderingContext.FLOAT_VEC2: return "vec2";
    case WebGLRenderingContext.FLOAT_VEC3: return "vec3";
    case WebGLRenderingContext.FLOAT_VEC4: return "vec4";
    case WebGLRenderingContext.INT_VEC2: return "ivec2";
    case WebGLRenderingContext.INT_VEC3: return "ivec3";
    case WebGLRenderingContext.INT_VEC4: return "ivec4";
    default: throw new Error('Invalid type: ' + type);
  }
}

function preprocess(shader: string, cb: (sh: string) => void): void {
  let lines = shader.split("\n");
  let barrier = AB.create();
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    let m = l.match(/^#include +"([^"]+)"/);
    if (m != null) {
      getter.preloadString(m[1], barrier.callback(i + ''));
    }
  }
  barrier.wait((incs) => {
    let res = [];
    for (let i = 0; i < lines.length; i++) {
      let inc = incs[i + ''];
      res.push(inc == undefined ? lines[i] : inc);
    }
    cb(res.join("\n"));
  });
}

let setters = {
  mat4: (gl: WebGLRenderingContext, loc, val) => gl.uniformMatrix4fv(loc, false, val),
  ivec2: (gl: WebGLRenderingContext, loc, val) => gl.uniform2iv(loc, val),
  vec2: (gl: WebGLRenderingContext, loc, val) => gl.uniform2fv(loc, val),
  vec3: (gl: WebGLRenderingContext, loc, val) => gl.uniform3fv(loc, val),
  vec4: (gl: WebGLRenderingContext, loc, val) => gl.uniform4fv(loc, val),
  int: (gl: WebGLRenderingContext, loc, val) => gl.uniform1i(loc, val),
  float: (gl: WebGLRenderingContext, loc, val) => gl.uniform1f(loc, val),
  sampler2D: (gl: WebGLRenderingContext, loc, val) => gl.uniform1i(loc, val),
}

export function setUniform(gl: WebGLRenderingContext, shader: DS.Shader, name: string, value) {
  let uniform = shader.getUniforms()[name];
  if (uniform == undefined) return;
  let loc = shader.getUniformLocation(name, gl);
  let setter = setters[uniform.getType()];
  if (setter == undefined) throw new Error('Invalid type: ' + uniform.getType());
  setter(gl, loc, value);
}
