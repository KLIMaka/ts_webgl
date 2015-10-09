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

var ab = AB.create((results) => start(results));
IU.loadImage('resources/img/font.png', ab.callback('font'));
ab.wait();

function start(res) {

var gl = GL.createContext(600, 600, {alpha:false});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);

var pos = new Float32Array([0, 0, 0, 128, 128, 128, 128, 0]);
var tc = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);

var vertexBufs:any = {};
vertexBufs.aPos = MB.wrap(gl, pos, 2, gl.STATIC_DRAW);
vertexBufs.aTc = MB.wrap(gl, tc, 2, gl.STATIC_DRAW);
var indexBuffer = MB.genIndexBuffer(gl, 1, [0, 1, 2, 0, 2, 3]);
var font = TEX.createTexture(128, 128, gl, res.font);
var map = new Uint8Array(createText('Foo #$% Baz !!! '));
var mapTex = TEX.createTexture(4, 4, gl, map, gl.LUMINANCE, 1);

var control = C2D.create(gl);
control.setUnitsPerPixel(1);
// control.setPos(300, 300);
var shader = SHADERS.createShader(gl, 'resources/shaders/tile');
var MVP = control.getMatrix();
var struct = [gl.TRIANGLES, 6, 0];

var cmds = [
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, vertexBufs,
  BATCHER.indexBuffer, indexBuffer,
  BATCHER.uniforms, [
    'MVP', BATCHER.setters.mat4, MVP,
    'CELL', BATCHER.setters.vec3, [4, 4, 0],
    'TILE', BATCHER.setters.vec3, [16, 16, 0],
    'SIZE', BATCHER.setters.vec3, [128, 128, 0],
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

function createText(text:string) {
  var res = [];
  for (var i = 0; i < text.length; i++)
    res.push(text.charCodeAt(i));
  return res;
}