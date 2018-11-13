import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import MU = require('./libs/mathutils');
import CTRL = require('./modules/controller2d');
import CTRL3 = require('./modules/controller3d');
import GLM = require('./libs_js/glmatrix');
import BATCHER = require('./modules/batcher');
import SHADERS = require('./modules/shaders');
import MB = require('./modules/meshbuilder');
import UI = require('./modules/ui/ui');
import AB = require('./libs/asyncbarrier');
import GET = require('./libs/getter');
import OBJ = require('./modules/formats/obj');
import PP = require('./modules/pixelprovider');

class Tile {
  constructor(
    public length:number,
    public offset:number,
    public icon:PP.PixelProvider)
  {}
}

class Cell {
  constructor(
    public tileId:number,
    public ang:number=0)
  {}
}

class Layer {
  constructor(
    private objs:OBJ.ObjData,
    private shader:SHADERS.Shader,
    private cellW:number,
    private cellH:number,
    private layerW:number,
    private layerH:number,
    private layer:Cell[],
    private offset:number[])
  {}

  public render(ctrl:CTRL3.Controller3D, gl:WebGLRenderingContext):void {
    var cmds = [
      BATCHER.shader, this.shader,
      BATCHER.vertexBuffers, this.objs.vertexBuffers,
      BATCHER.indexBuffer, this.objs.indexBuffer,
      BATCHER.uniforms, [
        'VP', BATCHER.setters.mat4, () => ctrl.getMatrix(),
        'LIGHT_DIR', BATCHER.setters.vec3, () => ctrl.getCamera().forward()
      ]
    ]
    for (var x = 0; x < this.layerW; x++) {
      for (var y = 0; y < this.layerH; y++) {
        var cell = this.layer[y*this.layerW+x];
        if (cell == undefined)
          continue;
        var offset = this.objs.offsets[cell.tileId];
        var length = this.objs.lengths[cell.tileId];
        var xoff = x * this.cellW + this.offset[0];
        var yoff = y * this.cellH + this.offset[2];
        var zoff = this.offset[1];
        cmds.push(
          BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(xoff, yoff, zoff, cell.ang)],
          BATCHER.drawCall, [gl.TRIANGLES, length, offset]
        );
      }
    }
    BATCHER.exec(cmds, gl);
  }
}

var ab = AB.create();
GET.preloadString('resources/models/floor.obj', ab.callback('floor'));
GET.preloadString('resources/models/corner2.obj', ab.callback('corner'));
GET.preloadString('resources/models/wall2.obj', ab.callback('wall'));
GET.preloadString('resources/models/Stormtrooper.obj', ab.callback('troper'));
ab.wait((res) => start(res));

function modelMatrix(x:number, y:number, z:number, ang:number) {
  var mat = GLM.mat4.create();
  mat = GLM.mat4.translate(mat, mat, GLM.vec3.fromValues(x, z, y));
  mat = GLM.mat4.rotateY(mat, mat, MU.deg2rad(ang));
  return mat;
}

function start(res) {
var gl = GL.createContext(800, 600, {alpha:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var model = OBJ.loadObjs([res.corner, res.floor, res.wall, res.troper], gl);
var shader = SHADERS.createShader(gl, 'resources/shaders/simple');
var ctrl = new CTRL3.Controller3D(gl);
var map = [];
var layer = new Layer(model, shader, 10, 10, 10, 10, map, [0, 0, 0]);

// map[0+10*0] = new Cell(0, 0);
// map[0+10*2] = new Cell(0, 90);
// map[2+10*2] = new Cell(0, 180);
// map[2+10*0] = new Cell(0, 270);
// map[0+10*1] = new Cell(2, 0);
// map[1+10*2] = new Cell(2, 90);
// map[2+10*1] = new Cell(2, 180);
// map[1+10*0] = new Cell(2, 270);
// map[1+10*1] = new Cell(1, 0);
// map[5+10*5] = new Cell(3, 0);

var tileId = 0;
var tileset = UI.panel('tileset')
  .pos('0', '600')
  .css('position', 'absolute');
var corner = UI.button('Corner');
corner.elem().onclick = (e:MouseEvent) => {tileId = 0}
var wall = UI.button('Wall');
wall.elem().onclick = (e:MouseEvent) => {tileId = 2}
var floor = UI.button('Floor');
floor.elem().onclick = (e:MouseEvent) => {tileId = 1}
var st = UI.button('stroop');
st.elem().onclick = (e:MouseEvent) => {tileId = 3}
tileset.append(corner);
tileset.append(wall);
tileset.append(floor);
tileset.append(st);
document.body.appendChild(tileset.elem());

var layerMap = UI.panel('Map')
  .pos('800', '0')
  .css('position', 'absolute');
var tiles = UI.table();
for (var x = 0; x < 10; x++) {
  var row = [];
  for (var y = 0; y < 10; y++) {
    var cell = UI.div('cell')
      .size('16', '16')
      .css('background-color', 'white');
    cell.elem().onclick = ((x,y,cell) => {
      return (e:MouseEvent) => {
        if (map[x+y*10] == undefined) {
          map[x+y*10] = new Cell(tileId, 0)
        } 
        map[x+y*10].tileId = tileId; 
        map[x+y*10].ang += 90 
        cell.text(tileId+'');
      }
    }) (x, y, cell);
    row.push(cell);
  }
  tiles.row(row);
}
layerMap.append(tiles);
document.body.appendChild(layerMap.elem());


GL.animate(gl, (gl:WebGLRenderingContext, t:number) => {
  ctrl.move(t / 500);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  layer.render(ctrl, gl);
});

}