import { Definition, Shader } from "./drawstruct";
import { AsyncBarrier } from "../libs/asyncbarrier";
import { preloadString } from "../libs/getter";

let defaultFSH = 'void main(){gl_FragColor = vec4(0.0);}';
let defaultVSH = 'void main(){gl_Position = vec4(0.0);}';
let defaultProgram: WebGLProgram = null;

export class ShaderImpl implements Shader {

  private program: WebGLProgram;
  private uniforms: WebGLUniformLocation[] = [];
  private attribs: number[] = [];
  private definitions: Definitions = new Definitions();
  private initCallback: (shader: Shader) => void;
  private uniformIndex: { [index: string]: number } = {};
  private attributeIndex: { [index: string]: number } = {};

  constructor(prog: WebGLProgram, initCallback: (shader: Shader) => void = null) {
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
    for (let i = 0; i < this.definitions.uniforms.length; i++) {
      let uniform = this.definitions.uniforms[i];
      this.uniformIndex[uniform.getName()] = i;
      this.uniforms[i] = gl.getUniformLocation(this.program, uniform.getName());
    }
  }

  private initAttributeLocations(gl: WebGLRenderingContext): void {
    for (let i = 0; i < this.definitions.attributes.length; i++) {
      let attrib = this.definitions.attributes[i];
      this.attributeIndex[attrib.getName()] = i;
      this.attribs[i] = gl.getAttribLocation(this.program, attrib.getName());
    }
  }

  public getUniformLocation(name: string, gl: WebGLRenderingContext): WebGLUniformLocation {
    return this.uniforms[this.uniformIndex[name]];
  }

  public getAttributeLocation(name: string, gl: WebGLRenderingContext): number {
    return this.attribs[this.attributeIndex[name]];
  }

  public getProgram(): WebGLProgram {
    return this.program;
  }

  public getUniforms(): Definition[] {
    return this.definitions.uniforms;
  }

  public getUniform(name: string): Definition {
    return this.definitions.uniforms[this.uniformIndex[name]];
  }

  public getAttributes(): Definition[] {
    return this.definitions.attributes;
  }

  public getAttribute(name: string): Definition {
    return this.definitions.attributes[this.attributeIndex[name]];
  }


  public getSamplers(): Definition[] {
    return this.definitions.samplers;
  }
}

export function createShader(gl: WebGLRenderingContext, name: string, defines: string[] = [], initCallback: (shader: Shader) => void = null): Shader {
  if (defaultProgram == null) {
    defaultProgram = compileProgram(gl, defaultVSH, defaultFSH);
  }

  let shader = new ShaderImpl(defaultProgram, initCallback);
  let barrier = new AsyncBarrier();
  let deftext = prepareDefines(defines);
  preloadString(name + '.vsh', barrier.callback('vsh'));
  preloadString(name + '.fsh', barrier.callback('fsh'));
  barrier.wait((res) => { initShader(gl, shader, deftext + res.vsh, deftext + res.fsh) });
  return shader;
}

export function createShaderFromSrc(gl: WebGLRenderingContext, vsh: string, fsh: string): Shader {
  let shader = new ShaderImpl(compileProgram(gl, vsh, fsh));
  initShader(gl, shader, vsh, fsh);
  return shader;
}

function initShader(gl: WebGLRenderingContext, shader: ShaderImpl, vsh: string, fsh: string) {
  let barrier = new AsyncBarrier();
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

export class DefinitionImpl implements Definition {
  constructor(
    private type: string,
    private name: string
  ) { }

  getName() { return this.name }
  getType() { return this.type }
}

export class Definitions {
  public uniforms: Definition[] = [];
  public attributes: Definition[] = [];
  public samplers: Definition[] = [];
}


function processShaders(gl: WebGLRenderingContext, program: WebGLProgram): any {
  let defs = new Definitions();
  let attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let a = 0; a < attribs; a++) {
    let info = gl.getActiveAttrib(program, a);
    defs.attributes.push(convertToDefinition(info));
  }
  let uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let u = 0; u < uniforms; u++) {
    let info = gl.getActiveUniform(program, u);
    let def = convertToDefinition(info);
    defs.uniforms.push(def);
    if (def.getType() == 'sampler2D')
      defs.samplers.push(def);
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
  let barrier = new AsyncBarrier();
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    let m = l.match(/^#include +"([^"]+)"/);
    if (m != null) {
      preloadString(m[1], barrier.callback(i + ''));
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
  mat4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniformMatrix4fv(loc, false, val),
  ivec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Int32List) => gl.uniform2iv(loc, val),
  vec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform2fv(loc, val),
  vec3: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform3fv(loc, val),
  vec4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform4fv(loc, val),
  int: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
  float: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1f(loc, val),
  sampler2D: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
}

export function setUniform(gl: WebGLRenderingContext, shader: Shader, name: string, value: any) {
  let uniform = shader.getUniform(name);
  if (uniform == undefined) return;
  let loc = shader.getUniformLocation(name, gl);
  let setter = setters[uniform.getType()];
  if (setter == undefined) throw new Error('Invalid type: ' + uniform.getType());
  setter(gl, loc, value);
}
