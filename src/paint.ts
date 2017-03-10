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
var cw = w;
var ch = h;

function createImage() {
  var img = new Uint8Array(cw*ch);
  return img;
}

function createPal() {
  var pal = new Uint8Array(256*3);
  for (var i  = 0; i < 256; i++) {
    var idx = i*3;
    pal[idx+0] = i;
    pal[idx+1] = i;
    pal[idx+2] = i;
  }
  return pal;
}

function addC64Colors(pal:Uint8Array) {
  pal[0]  = 0;   pal[1]  =   0; pal[2]  =   0;
  pal[3]  = 62;  pal[4]  =  49; pal[5]  = 162;
  pal[6]  = 87;  pal[7]  =  66; pal[8]  =   0;
  pal[9]  = 140; pal[10] =  62; pal[11] =  52;
  pal[12] = 84;  pal[13] =  84; pal[14] =  84;
  pal[15] = 141; pal[16] =  72; pal[17] = 179;
  pal[18] = 144; pal[19] =  95; pal[20] =  37;
  pal[21] = 124; pal[22] = 112; pal[23] = 218;
  pal[24] = 128; pal[25] = 128; pal[26] = 128;
  pal[27] = 104; pal[28] = 169; pal[29] =  65;
  pal[30] = 187; pal[31] = 119; pal[32] = 109;
  pal[33] = 122; pal[34] = 191; pal[35] = 199;
  pal[36] = 171; pal[37] = 171; pal[38] = 171;
  pal[39] = 208; pal[40] = 220; pal[41] = 113;
  pal[42] = 172; pal[43] = 234; pal[44] = 136;
  pal[45] = 255; pal[46] = 255; pal[47] = 255;
}

var refPalette = createPal();
addC64Colors(refPalette);
var pixel = 255;

function cssColor(idx:number):string {
  var r = ("0" + refPalette[idx*3+0].toString(16)).slice(-2);
  var g = ("0" + refPalette[idx*3+1].toString(16)).slice(-2);
  var b = ("0" + refPalette[idx*3+2].toString(16)).slice(-2);
  return '#' + r + g + b;
}

var gl = GL.createContext(w, h);

var info = {
  'X:':0,
  'Y:':0,
  'Color:':0
}
var panel = UI.panel('Info');
panel.pos('800', '0');
var props = UI.props(['X:', 'Y:', 'Color:']);
panel.append(props);
document.body.appendChild(panel.elem());

var palette = UI.div('frame');
palette.pos('0', '600');
var colors = UI.table();
var colorProbes = [];
for (var row = 0; row < 8; row++) {
  var colorRow = [];
  for (var col = 0; col < 32; col++) {
    var idx = row*32 + col;
    var c = UI.div('pal_color')
      .size('16', '16')
      .css('background-color', cssColor(idx));
    c.elem().onclick = ((idx:number) => {return (e:MouseEvent) => { setColor(idx) }})(idx);
    colorRow.push(c);
    colorProbes.push(c);
  }
  colors.row(colorRow);
}
palette.append(colors);
document.body.appendChild(palette.elem());

var picker = UI.div('frame')
  .pos('646', '600')
  .size('162', '162');
var primary = UI.div('primary')
  .size('100', '100')
  .pos('10', '10')
  .css('background-color', '#999')
  .css('position', 'absolute');
picker.append(primary);

var colorPicker = UI.tag('input')
  .attr('type', 'color')
  .pos('10', '120')
  .css('position', 'absolute');
colorPicker.elem().onchange = (e:Event) => {
  var value = (<HTMLInputElement>colorPicker.elem()).value;
  var rgba = MU.int2vec4(parseInt(value.substr(1), 16));
  var idx = pixel;
  refPalette[idx*3+0] = rgba[2];
  refPalette[idx*3+1] = rgba[1];
  refPalette[idx*3+2] = rgba[0];
  pal.reload(gl);
  var probe = colorProbes[idx];
  probe.css('background-color', cssColor(idx));
  setColor(idx);
}
picker.append(colorPicker);
document.body.appendChild(picker.elem());

function setColor(col:number):void {
  var prevCol = pixel;
  pixel = col;
  primary.css('background-color', cssColor(col));
  (<HTMLInputElement>colorPicker.elem()).value = cssColor(col);
  info['Color:'] = col;
  props.refresh(info);
}

function genPut(buf:Uint8Array):CANV.PutFunc {
  return (x:number, y:number) => {
    if (x >= 0 && y >= 0 && x < cw && y < ch) {
      buf[y*cw+x] = pixel;
      buf[y*cw+cw-x] = pixel;
      buf[(ch-y)*cw+x] = pixel;
      buf[(ch-y)*cw+cw-x] = pixel;
      // buf[(y+1)*cw+x+1] = pixel;
      // buf[(y-1)*cw+x-1] = pixel;
    }
  }
}

var over = new Uint8Array(cw*ch);
var overPut = genPut(over);
function redrawOverlay(x:number, y:number):void {
  var ix = MU.int(x);
  var iy = MU.int(y);
  over.fill(0, 0, cw*ch);
  if (x >= 0 && y >= 0 && x < cw && y < ch)
    overPut(ix, iy);
  // var cx = cw/2-x;
  // var cy = ch/2-y;
  // var abs = Math.abs;
  // var r = Math.sqrt(cx*cx+cy*cy);
  // var k = abs(abs(cx) - abs(cy)) / r;
  // CANV.circle(overPut, cw/2, ch/2, r|0, -20+40*k);
  // CANV.line(over, cw, ch, cw/2, ch/2, x, y, 12);
}
var options = {filter:gl.NEAREST, repeat:gl.CLAMP_TO_EDGE};
var img = createImage();
var control = CTRL.create(gl);
var tex = TEX.createDrawTexture(cw, ch, gl, options, img, gl.LUMINANCE, 1);
var overlay = TEX.createDrawTexture(cw, ch, gl, options, over, gl.LUMINANCE, 1);
var pal = TEX.createTexture(256, 1, gl, options, refPalette, gl.RGB, 3);
control.setPos(cw/2, ch/2);

var put = genPut(img);
var px = 0;
var py = 0;

gl.canvas.onmousemove = (e) => {
  var pos = control.unproject(e.clientX, e.clientY);
  var x = pos[0] < 0 ? pos[0]-1 : pos[0];
  var y = pos[1] < 0 ? pos[1]-1 : pos[1];
  var ix = MU.int(x);
  var iy = MU.int(y);
  redrawOverlay(x, y);
  overlay.reload(gl);

  if ((e.buttons & 1)==1){
    CANV.line(put, ix, iy, px, py);
    tex.reload(gl);
  }

  px = ix;
  py = iy;

  info['X:'] = ix;
  info['Y:'] = iy;
  props.refresh(info);
}

gl.canvas.addEventListener("touchmove", (e:TouchEvent) => {
  var touch = e.touches[0];
  var pos = control.unproject(touch.clientX, touch.clientY);
  var x = pos[0] < 0 ? pos[0]-1 : pos[0];
  var y = pos[1] < 0 ? pos[1]-1 : pos[1];
  var ix = MU.int(x);
  var iy = MU.int(y);
  redrawOverlay(x, y);
  overlay.reload(gl);

  CANV.line(put, ix, iy, px, py);
  tex.reload(gl);

  px = ix;
  py = iy;

  info['X:'] = ix;
  info['Y:'] = iy;
  props.refresh(info);
});

gl.canvas.addEventListener("touchstart", (e:TouchEvent) => {
  var touch = e.touches[0];
  var pos = control.unproject(touch.clientX, touch.clientY);
  var x = pos[0] < 0 ? pos[0]-1 : pos[0];
  var y = pos[1] < 0 ? pos[1]-1 : pos[1];
  var ix = MU.int(x);
  var iy = MU.int(y);

  px = ix;
  py = iy;
});

document.onkeypress = (e:KeyboardEvent) => {
  if (e.key == '`') {
    control.setPos(cw/2, ch/2);
    control.setUnitsPerPixel(1);
  }
  if (e.key == '9') {
    setColor((pixel-1)%255);
  }
  if (e.key == '0') {
    setColor((pixel+1)%255);
  }
}

var pos = new Float32Array([0, 0, cw, 0, cw, ch, 0, ch]);
var tc = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
var aPos = MB.wrap(gl, pos, 2, gl.DYNAMIC_DRAW);
var aTc = MB.wrap(gl, tc, 2, gl.DYNAMIC_DRAW);
var vertexBufs = {'aPos': aPos,'aTc': aTc};
var indexBuffer = MB.genIndexBuffer(gl, 4, [0, 1, 2, 0, 2, 3]);
var shader = SHADERS.createShader(gl, 'resources/shaders/indexed');
var uniforms = ['MVP', BATCHER.setters.mat4, control.getMatrix()];
var cmds = [
  BATCHER.clear, [0.1, 0.1, 0.1, 1.0],
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, vertexBufs,
  BATCHER.indexBuffer, indexBuffer,
  BATCHER.uniforms, uniforms,
  BATCHER.sampler, [0, 'base', tex.get()],
  BATCHER.sampler, [1, 'pal', pal.get()],
  BATCHER.sampler, [2, 'overlay', overlay.get()],
  BATCHER.drawCall, [gl.TRIANGLES, 6, 0]
];

GL.animate(gl, function (gl:WebGLRenderingContext, time:number) {
  uniforms[2] = control.getMatrix();
  BATCHER.exec(cmds, gl);
});