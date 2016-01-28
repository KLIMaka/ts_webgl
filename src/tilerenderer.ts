import MU = require('./libs/mathutils');
import P = require('modules/particles');
import GL = require('modules/gl');
import MB = require('modules/meshbuilder');
import C2D = require('./modules/controller2d');
import SHADERS = require('./modules/shaders');
import BATCHER = require('./modules/batcher');
import GLM = require('./libs_js/glmatrix');
import AB = require('./libs/asyncbarrier');
import IU = require('./libs/imgutils');
import TEX = require('./modules/textures');
import PU = require('./modules/pixel/utils');
import DS = require('./modules/drawstruct');

var ab = AB.create((results) => start(results));
IU.loadImage('resources/img/font.png', ab.callback('font'));
ab.wait();

class Atlas {
  private tex:DS.Texture;

  constructor(gl:WebGLRenderingContext, img:Uint8Array, private w:number, private h:number, private sw:number, private sh:number) {
    this.tex = TEX.createTexture(w, h, gl, img);
  }
}

class Plane {
  private tex:DS.Texture;
  private data:Uint8Array;

  constructor(gl:WebGLRenderingContext, private w:number, private h:number, private atlas:Atlas) {
    this.data = new Uint8Array(w*h);
    this.tex = TEX.createTexture(w, h, gl, this.data, gl.LUMINANCE, 1);
    
  }
}

function start(res) {

var gl = GL.createContext(600, 600, {alpha:false});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);

var w = 32;
var h = 32;

var pos = new Float32Array([0, 0, 0, h*8, w*8, h*8, w*8, 0]);
var tc = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);

var vertexBufs:any = {};
vertexBufs.aPos = MB.wrap(gl, pos, 2, gl.STATIC_DRAW);
vertexBufs.aTc = MB.wrap(gl, tc, 2, gl.STATIC_DRAW);
var indexBuffer = MB.genIndexBuffer(gl, 1, [0, 1, 2, 0, 2, 3]);
var font = TEX.createTexture(128, 128, gl, res.font);
var map = new Uint8Array(w*h);
PU.printString(0, 0, w, 4, map, "Foo\n#$% Baz !!! ");
PU.printString(10, 10, w, 22, map, "\1\2\3 Hello folks!!!");
var mapTex = TEX.createTexture(w, h, gl, map, gl.LUMINANCE, 1);

var control = C2D.create(gl);
control.setPos(150, 150);
control.setUnitsPerPixel(0.5);
var shader = SHADERS.createShader(gl, 'resources/shaders/tile');
var MVP = control.getMatrix();
var struct = [gl.TRIANGLES, 6, 0];

var cmds = [
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, vertexBufs,
  BATCHER.indexBuffer, indexBuffer,
  BATCHER.uniforms, [
    'MVP', BATCHER.setters.mat4, MVP,
    'CELL', BATCHER.setters.vec2, [w, h],
    'TILE', BATCHER.setters.vec2, [16, 16],
  ],
  BATCHER.sampler, [0, 'tiles', font.get()],
  BATCHER.sampler, [1, 'map', mapTex.get()],
  BATCHER.drawCall, struct
];

GL.animate(gl, function (gl:WebGLRenderingContext, dt:number) {
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  BATCHER.exec(cmds, gl);
});

}
