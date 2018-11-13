import BS = require('./structs');
import MU = require('../../../libs/mathutils');
import VEC = require('../../../libs/vecmath');
import GLU = require('../../../libs_js/glutess');
import mb = require('../../meshbuilder');
import DS = require('../../drawstruct');
import U = require('./utils');

export class Renderer {
  private walls = {};

  constructor(private board:BS.Board) {}

  public render(gl:WebGLRenderingContext) {
    var board = this.board;
    var sectors = board.sectors;
    var walls = board.walls;

    for (var w = 0; w < walls.length; w++) {
      var wall = walls[w];
      var wall2 = walls[wall.point2];
      var nextw = wall.nextwall;

      if (nextw == -1) {
        this.addOuterWall(w, wall);
      } else {
        if (this.walls[w+'-'+nextw] != undefined)
          continue;
        this.addInnerWall(w, wall, nextw, walls[nextw]);
      }
    }
  }
}