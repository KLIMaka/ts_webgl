import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import { Deck } from '../../../collections';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import { Board } from '../structs';
import * as U from '../utils';
import * as BGL from './buildgl';
import { Context } from './context';
import { Renderable } from './renderable';
import { BuildRenderableProvider } from '../edit/messages';

export function draw(renderables: BuildRenderableProvider, ms: U.MoveStruct, ctr: Controller3D) {
  drawGeometry(renderables, ms, ctr);
}