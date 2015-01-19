import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import DS = require('./modules/drawstruct');
import MAT = require('./modules/materials');
import MU = require('./libs/mathutils');
import mb = require('./modules/meshbuilder');
import ctrl = require('./modules/controller2d');
import shaders = require('./modules/shaders');
import GLM = require('./libs_js/glmatrix');

var w = 800;
var h = 600;

function buildScreen(gl:WebGLRenderingContext, shader:DS.Shader, tex:DS.Texture) {
  var builder = new mb.MeshBuilderConstructor(4)
    .buffer('pos', Float32Array, gl.FLOAT, 2)
    .buffer('norm', Float32Array, gl.FLOAT, 2)
    .index(Uint16Array, gl.UNSIGNED_SHORT)
    .build();

  builder.start(mb.QUADS)
    .attr('norm', [0, 0]).vtx('pos', [0, 0])
    .attr('norm', [1, 0]).vtx('pos', [16, 0])
    .attr('norm', [1, 1]).vtx('pos', [16, 16])
    .attr('norm', [0, 1]).vtx('pos', [0, 16])
    .end();
  return builder.build(gl, MAT.create(shader, {texture:tex}));
}

function createImage() {
  var img = new Uint8Array(16*16*4);
  for (var i = 0; i < 256; i++){
    var idx = i*4;
    img[idx+0] = MU.cyclic(i*3, 256);
    img[idx+1] = MU.cyclic(i*6, 256);
    img[idx+2] = MU.cyclic(i*9, 256);
    img[idx+3] = 255;
  }
  return img;
}

var img = createImage();
var gl = GL.createContext(w, h);
var control = ctrl.create(gl);
var tex = TEX.createDrawTexture(16, 16, gl, img);
var screen = buildScreen(gl, shaders.createShader(gl, 'resources/shaders/base1'), tex);
control.setPos(gl.drawingBufferWidth/2, gl.drawingBufferHeight/2);

gl.canvas.onclick = (e) => {
  var vec = GLM.vec3.fromValues(e.layerX, e.layerY, 0);
  var mat = control.getMatrix();
  GLM.vec3.transformMat3(vec, vec, mat);
  console.log(vec);
}

var binder = GL.binder([
  ['MVP', GL.mat4Setter,     ()=>control.getMatrix()],
]);

GL.animate(gl, function (gl:WebGLRenderingContext, time:number) {
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  GL.draw(gl, [screen], binder);
});