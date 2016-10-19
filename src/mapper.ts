import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import MU = require('./libs/mathutils');
import CTRL = require('./modules/controller2d');
import GLM = require('./libs_js/glmatrix');
import BATCHER = require('./modules/batcher');
import SHADERS = require('./modules/shaders');
import MB = require('./modules/meshbuilder');
import UI = require('./modules/ui/ui');
import CANV = require('./modules/pixel/canvas');

class Point {
  constructor(
    public x:number,
    public y:number
  ){}
}

class Segment {
  constructor(
    public start:Point,
    public end:Point
  ){}
}

class Polygon {
  constructor(
    public contour:Point[]
  ){}
}

