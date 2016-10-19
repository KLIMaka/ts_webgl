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

var w = 800;
var h = 600;
var gl = GL.createContext(w, h);

var draw = TEX.createRenderTexture(64, 64, gl, {filter:gl.NEAREST});
var pos = new Float32Array([]);
var tc = new Float32Array([]);
var color = new Float32Array([]);
var aPos = MB.wrap(gl, pos, 2, gl.DYNAMIC_DRAW);
var aTc = MB.wrap(gl, tc, 2, gl.DYNAMIC_DRAW);
var aColor = MB.wrap(gl, color, 3, gl.DYNAMIC_DRAW);
var vertexBufs = {'aPos': aPos,'aTc': aTc, 'aColor':aColor};
var indexBuffer = MB.genIndexBuffer(gl, 3, [0, 1, 2]);
