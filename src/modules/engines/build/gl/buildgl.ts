import {State} from '../../../stategl';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import * as GLM from '../../../../libs_js/glmatrix';
import * as BUFF from './buffers';
import {Renderable, Type} from './renderable';
import * as AB from '../../../../libs/asyncbarrier';


const SHADER_NAME = 'resources/shaders/build_base1';
var state:State;
export function init(gl:WebGLRenderingContext, pal:DS.Texture, plu:DS.Texture, grid:DS.Texture, cb:()=>void) {
  var ab = AB.create();
  SHADER.createShader(gl, SHADER_NAME, ['PAL_LIGHTING'], ab.callback('baseShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'PAL_LIGHTING'], ab.callback('spriteShader'));
  SHADER.createShader(gl, SHADER_NAME, ['FLAT'], ab.callback('baseFlatShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'FLAT'], ab.callback('spriteFlatShader'));
  SHADER.createShader(gl, SHADER_NAME, ['PARALLAX'], ab.callback('parallax'));
  SHADER.createShader(gl, SHADER_NAME, ['GRID'], ab.callback('grid'));
  ab.wait((res) => {
    state = new State(gl);
    state.registerShader('baseShader', res['baseShader']);
    state.registerShader('spriteShader', res['spriteShader']);
    state.registerShader('baseFlatShader', res['baseFlatShader']);
    state.registerShader('spriteFlatShader', res['spriteFlatShader']);
    state.registerShader('parallax', res['parallax']);
    state.registerShader('grid', res['grid']);
    
    BUFF.init(gl, 1024*64);
    state.setIndexBuffer(BUFF.getIdxBuffer());
    state.setVertexBuffer('aPos', BUFF.getPosBuffer());
    state.setVertexBuffer('aNorm', BUFF.getNormBuffer());
    state.setTexture('pal', pal);
    state.setTexture('plu', plu);
    state.setTexture('grid', grid);

    cb();
  });
}

let inv = GLM.mat4.create();
export function setViewMatrices(proj:GLM.Mat4Array, view:GLM.Mat4Array, pos:GLM.Vec3Array) {
  state.setUniform('P', proj);
  state.setUniform('V', view);
  state.setUniform('IV', GLM.mat4.invert(inv, view));
  state.setUniform('eyepos', pos);
}

export function setCursorPosiotion(pos:GLM.Vec3Array) {
  state.setUniform('curpos', pos);
}

export function setClipPlane(x:number, y:number, z:number, w:number) {
  state.setUniform('clipPlane', [x, y, z, w]);
}

export function draw(gl:WebGLRenderingContext, renderable:Renderable) {
  if (renderable == null)
    return;
  renderable.draw(gl, state);
}

export function newFrame() {
  state.setUniform('time', performance.now());
}


