import * as AB from '../../../../libs/asyncbarrier';
import * as GLM from '../../../../libs_js/glmatrix';
import { Collection } from '../../../collections';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import { State } from '../../../stategl';
import * as BUFF from './buffers';
import { Renderable } from './renderable';
import { BuildContext } from '../api';

const SHADER_NAME = 'resources/shaders/build_base1';
var state: State;
export function init(gl: WebGLRenderingContext, pal: DS.Texture, plu: DS.Texture, palswaps: number, shadowsteps: number, grid: DS.Texture, cb: () => void) {
  let palswapsDef = 'PALSWAPS (' + palswaps + '.0)';
  let shadowstepsDef = 'SHADOWSTEPS (' + shadowsteps + '.0)';

  var ab = AB.create();
  SHADER.createShader(gl, SHADER_NAME, ['PAL_LIGHTING', palswapsDef, shadowstepsDef], ab.callback('baseShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'PAL_LIGHTING', palswapsDef, shadowstepsDef], ab.callback('spriteShader'));
  SHADER.createShader(gl, SHADER_NAME, ['FLAT', palswapsDef, shadowstepsDef], ab.callback('baseFlatShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'FLAT', palswapsDef, shadowstepsDef], ab.callback('spriteFlatShader'));
  SHADER.createShader(gl, SHADER_NAME, ['PARALLAX', palswapsDef, shadowstepsDef], ab.callback('parallax'));
  SHADER.createShader(gl, SHADER_NAME, ['GRID', palswapsDef, shadowstepsDef], ab.callback('grid'));

  ab.wait((res) => {
    state = new State();
    state.registerShader('baseShader', res['baseShader']);
    state.registerShader('spriteShader', res['spriteShader']);
    state.registerShader('baseFlatShader', res['baseFlatShader']);
    state.registerShader('spriteFlatShader', res['spriteFlatShader']);
    state.registerShader('parallax', res['parallax']);
    state.registerShader('grid', res['grid']);

    BUFF.init(gl);
    state.setTexture('pal', pal);
    state.setTexture('plu', plu);
    state.setTexture('grid', grid);

    cb();
  });
}

export function setProjectionMatrix(proj: GLM.Mat4Array) {
  state.setUniform('P', proj);
}

let inv = GLM.mat4.create();
export function setViewMatrix(view: GLM.Mat4Array) {
  state.setUniform('V', view);
  state.setUniform('IV', GLM.mat4.invert(inv, view));
}

export function setPosition(pos: GLM.Vec3Array) {
  state.setUniform('eyepos', pos);
}

let pos = GLM.vec3.create();
export function setCursorPosiotion(x: number, y: number, z: number) {
  GLM.vec3.set(pos, x, y, z);
  state.setUniform('curpos', pos);
}

let clipPlane = GLM.vec4.create();
export function setClipPlane(x: number, y: number, z: number, w: number) {
  GLM.vec4.set(clipPlane, x, y, z, w);
  state.setUniform('clipPlane', clipPlane);
}

export function draw(ctx: BuildContext, gl: WebGLRenderingContext, renderable: Renderable) {
  if (renderable == null) return;
  renderable.draw(ctx, gl, state);
}

export function drawAll(ctx: BuildContext, gl: WebGLRenderingContext, renderables: Collection<Renderable>) {
  for (let r of renderables) draw(ctx, gl, r);
}

export function newFrame(gl: WebGLRenderingContext) {
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  state.setUniform('time', performance.now());
}


