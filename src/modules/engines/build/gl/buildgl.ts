import {State} from '../../../stategl';
import * as DS from '../../../drawstruct';
import * as SHADER from '../../../shaders';
import * as GLM from '../../../../libs_js/glmatrix';
import * as C from '../../../../modules/controller3d';
import * as BUFF from './buffers';
import {Renderable, Type} from './renderable';
import * as AB from '../../../../libs/asyncbarrier';

const SHADER_NAME = 'resources/shaders/build_base1';
var state:State;
export function init(gl:WebGLRenderingContext, pal:DS.Texture, plu:DS.Texture, cb:()=>void) {
  var ab = AB.create();
  SHADER.createShader(gl, SHADER_NAME, ['TC_GRID', 'PAL_LIGHTING'], ab.callback('baseShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE'], ab.callback('spriteShader'));
  SHADER.createShader(gl, SHADER_NAME, ['FLAT'], ab.callback('baseFlatShader'));
  SHADER.createShader(gl, SHADER_NAME, ['SPRITE', 'FLAT'], ab.callback('spriteFlatShader'));
  ab.wait((res) => {
    state = new State(gl);
    state.registerShader('baseShader', res['baseShader']);
    state.registerShader('spriteShader', res['spriteShader']);
    state.registerShader('baseFlatShader', res['baseFlatShader']);
    state.registerShader('spriteFlatShader', res['spriteFlatShader']);
    
    BUFF.init(gl, 1024*64);
    state.setIndexBuffer(BUFF.getIdxBuffer());
    state.setVertexBuffer('aPos', BUFF.getPosBuffer());
    state.setVertexBuffer('aNorm', BUFF.getNormBuffer());
    state.setTexture('pal', pal);
    state.setTexture('plu', plu);

    cb();
  });
}

export function setController(c:C.Controller3D) {
  state.setUniform('P', c.getProjectionMatrix());
  state.setUniform('V', c.getModelViewMatrix());
  state.setUniform('eyepos', c.getCamera().getPos());
}

export function setCursorPosiotion(pos:GLM.Vec3Array) {
  state.setUniform('curpos', pos);
}

export function draw(gl:WebGLRenderingContext, renderable:Renderable) {
  renderable.draw(gl, state);
}

