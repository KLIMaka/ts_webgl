import * as AB from '../../../../libs/asyncbarrier';
import * as GLM from '../../../../libs_js/glmatrix';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import { State } from '../../../stategl';
import { BuildContext } from '../api';
import * as BUFF from './buffers';
import { Renderable } from './builders/renderable';
import { Type, Injector } from '../../../../libs/module';
import { GL_, UtilityTextures_ } from '../buildartprovider';

export const PAL_ = new Type<DS.Texture>('PAL');
export const PLUs_ = new Type<DS.Texture>('PLUs');
export const Shadowsteps_ = new Type<number>('Shadowsteps');
export const Palswaps_ = new Type<number>('Palswaps');

export function BuildGlModule(cb: () => void) {
  return (injector: Injector) => init(
    injector.getInstance(GL_),
    injector.getInstance(PAL_),
    injector.getInstance(PLUs_),
    injector.getInstance(Palswaps_),
    injector.getInstance(Shadowsteps_),
    injector.getInstance(UtilityTextures_)[-3],
    cb
  )
}

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
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE_FACE', palswapsDef, shadowstepsDef], ab.callback('spriteFaceShader'));

  ab.wait((res) => {
    state = new State();
    state.registerShader('baseShader', res['baseShader']);
    state.registerShader('spriteShader', res['spriteShader']);
    state.registerShader('baseFlatShader', res['baseFlatShader']);
    state.registerShader('spriteFlatShader', res['spriteFlatShader']);
    state.registerShader('parallax', res['parallax']);
    state.registerShader('grid', res['grid']);
    state.registerShader('spriteFaceShader', res['spriteFaceShader']);

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
  if (state.isUniformEnabled('IV')) state.setUniform('IV', GLM.mat4.invert(inv, view));
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

export function newFrame(gl: WebGLRenderingContext) {
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.clearStencil(0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  state.setUniform('sys', [performance.now(), 2 / gl.drawingBufferWidth, 2 / gl.drawingBufferHeight, 0]);
}

export function flush(gl: WebGLRenderingContext) {
  state.flush(gl);
}


