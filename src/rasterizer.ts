import MU = require('./libs/mathutils');
import GLM = require('./libs_js/glmatrix');


var canvas = <HTMLCanvasElement> document.getElementById('display');
var fpsCounter = document.getElementById('fps');
var ctx = canvas.getContext('2d');
ctx.msImageSmoothingEnabled = false;

function FastMath(stdlib, foreign, buffer) {
  "use asm";

  var fb = new stdlib.Int32Array(buffer);

  function fill(color) {
    color = color|0;
    var end = 1228800;
    var off = 0;
    for (off = 0; (off|0) < (end|0); off = (off+4)|0) {
      fb[off>>2] = color;
    }
  }

  function rect(color, x, y, w, h) {
    color = color|0;
    x = x|0;
    y = y|0;
    w = w|0;
    h = h|0;
    // w = ((x+w)|0) > 640 ? (640-x)|0 : w;
    // h = ((y+h)|0) > 480 ? (480-y)|0 : h;
    var off = 0, end = 0, dy = 0, endx = 0;
    off = ((y*640)|0 + x) << 2;
    end = off + (640*h << 2)|0;
    dy = 640 - w << 2;
    for (; (off|0) < (end|0); off = (off + dy)|0){
      endx = off + (w << 2)|0
      for (;(off|0) < (endx|0); off = (off + 4)|0) {
        fb[off>>2] = color;
      }
    }
  }

  return { 
    fill:fill,
    rect:rect
  };
}
var heap = new ArrayBuffer(0x200000);
var fast = FastMath(window, null, heap);  
var framebuffer = new Uint8ClampedArray(heap, 0, 640*480*4);
var fbi = new Int32Array(heap, 0, 640*480);
var data = new ImageData(framebuffer, 640, 480);
var zbuf = new Int16Array(640*480);

export function animate(callback:(time:number)=>void) {
  var time = new Date().getTime();

  function update() {
    var now = new Date().getTime();
    var dt = (now - time) / 1000;
    fpsCounter.innerText = dt + ' ms ' + (10000/dt) + ' rect per sec';
    callback(dt);
    //requestAnimationFrame(update);
    setTimeout(update);
    time = now;
  }
  update();
}

var rot = GLM.mat4.create();
var trans = GLM.mat4.create();
var vec1 = GLM.vec3.create();
var vec2 = GLM.vec3.create();
var vec3 = GLM.vec3.create();

var tris = [
  [[0xff99aa99], [-100, -100, -100], [100, -100, -100], [100, 100, -100]],
  [[0xffaa9999], [-100, -100, -100], [100, 100, -100], [-100, 100, -100]],
  [[0xff9999aa], [-100, -100, 100], [100, -100, 100], [100, 100, 100]],
  [[0xffaa99aa], [-100, -100, 100], [100, 100, 100], [-100, 100, 100]],
];


var ang = 0;
var tri = 2*Math.PI/3;
animate((dt) => {
  // hwFill();
  // swFill();
  // hwNoise();
  // swNoise();
  // hwRects(10000, 50);
  // swRects(10000, 200);
  // swFastRects(10000, 200);

  // swTriangles(100, 50);

  swFill(0xffffffff);
  zbuf.fill(0x8000, 0, 640*480);
  GLM.mat4.identity(rot);
  GLM.mat4.translate(rot, rot, [320, 240, 0]);
  GLM.mat4.rotateY(rot, rot, ang+=dt);
  // GLM.mat4.rotateX(rot, rot, ang+=dt);
  // GLM.mat4.rotateZ(rot, rot, ang+=dt);
  for (var i = 0; i < tris.length; i++) {
    GLM.vec3.transformMat4(vec1, tris[i][1], rot);
    GLM.vec3.transformMat4(vec2, tris[i][2], rot);
    GLM.vec3.transformMat4(vec3, tris[i][3], rot);
    triangleZ(tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec1[2]|0, vec2[0]|0, vec2[1]|0, vec2[2]|0, vec3[0]|0, vec3[1]|0, vec3[2]|0]);
    // triangle(tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec2[0]|0, vec2[1]|0, vec3[0]|0, vec3[1]|0]);
  }
  ctx.putImageData(data, 0, 0);

});

function rand256():number {
  return MU.int(Math.random()*256);
}

function randi(i:number):number {
  return MU.int(Math.random()*i);
}

function hwFill() {
  ctx.fillStyle = "green";
  ctx.fillRect(0, 0, 640, 480);
}

function swFill(color:number) {
  fbi.fill(color, 0, 640*480);
  ctx.putImageData(data, 0, 0);
}

function hwNoise() {
  for(var i = 0; i < 640*480; i++) {
    ctx.fillStyle = 'rgb('+rand256()+','+rand256()+','+rand256()+')';
    ctx.fillRect(i%640, i/480, 1, 1);
  }
}

function swNoise() {
  for (var i = 0; i < 640*480; i++) {
    fbi[i] = 0xff000000 | rand256() | (rand256() << 8) | (rand256() << 16);
  }
  ctx.putImageData(data, 0, 0);
}

function hwRects(count:number, size:number) {
  while(count--) {
    ctx.fillStyle = 'rgb('+rand256()+','+rand256()+','+rand256()+')';
    ctx.fillRect(randi(640), randi(480), randi(size), randi(size));
  }
}

function rect(color:number, x:number, y:number, w:number, h:number) {
  w = x+w > 640 ? 640-x : w; 
  h = y+h > 480 ? 480-y : h;
  var off = y * 640 + x;
  for (var dy = 0; dy < h; dy++) {
    fbi.fill(color, off, off+w);
    off += 640;
  }
}

function triangle(color:number, points:number[]) {
  var maxy = Math.min(Math.max(points[1], points[3], points[5]), 480);
  var miny = Math.max(Math.min(points[1], points[3], points[5]), 0);
  var dx1 = points[0]-points[2], 
      dx2 = points[2]-points[4], 
      dx3 = points[4]-points[0];
  var dy1 = points[1]-points[3], 
      dy2 = points[3]-points[5], 
      dy3 = points[5]-points[1];
  for(var y = miny; y <= maxy; y++) {
    var s1 = y-points[1], 
        s2 = y-points[3], 
        s3 = y-points[5];
    var x1 = points[0] + s1/dy1*dx1, 
        x2 = points[2] + s2/dy2*dx2,
        x3 = points[4] + s3/dy3*dx3;
    var lx = Math.max(Math.min(
        s1*s2 <= 0 ? x1 : Infinity,
        s2*s3 <= 0 ? x2 : Infinity,
        s3*s1 <= 0 ? x3 : Infinity), 0);
    var rx = Math.min(Math.max(
        s1*s2 <= 0 ? x1 : -Infinity,
        s2*s3 <= 0 ? x2 : -Infinity,
        s3*s1 <= 0 ? x3 : -Infinity), 639);
    var yoff = y*640;
    fbi.fill(color, yoff+Math.round(lx), yoff+Math.round(rx)+1);
  }
}

function triangleZ(color:number, points:number[]) {
  var maxy = Math.min(Math.max(points[1], points[4], points[7]), 480);
  var miny = Math.max(Math.min(points[1], points[4], points[7]), 0);
  var dx = [points[0]-points[3], points[3]-points[6], points[6]-points[0]];
  var dy = [points[1]-points[4], points[4]-points[7], points[7]-points[1]];
  var dz = [points[2]-points[5], points[5]-points[8], points[8]-points[2]];
  var idxs = [0, 0, 0];
  for(var y = miny; y <= maxy; y++) {
    var s = [y-points[1], y-points[4], y-points[7]];
    var k = [s[0]/dy[0], s[1]/dy[1], s[2]/dy[2]];
    var x = [points[0] + k[0]*dx[0], points[3] + k[1]*dx[1], points[6] + k[2]*dx[2]];
    var z = [points[2] + k[0]*dz[0], points[5] + k[1]*dz[1], points[8] + k[2]*dz[2]];
    var ss = [s[0]*s[1], s[1]*s[2], s[2]*s[0]];
    var i = 0;
    if (ss[0] <= 0) idxs[i++] = 0;
    if (ss[1] <= 0) idxs[i++] = 1;
    if (ss[2] <= 0) idxs[i++] = 2;
    if (i == 2) {
      var li = x[idxs[0]] < x[idxs[1]] ? idxs[0] : idxs[1];
      var ri = x[idxs[0]] < x[idxs[1]] ? idxs[1] : idxs[0];
    } else {
      var li = x[idxs[0]] < x[idxs[1]] ? x[idxs[0]] < x[idxs[2]] ? idxs[0] : idxs[2] : x[idxs[1]] < x[idxs[2]] ? idxs[1] : idxs[2];
      var ri = x[idxs[0]] > x[idxs[1]] ? x[idxs[0]] > x[idxs[2]] ? idxs[0] : idxs[0] : x[idxs[1]] > x[idxs[2]] ? idxs[1] : idxs[2];
    }
    var yoff = y*640;
    var lx = Math.round(Math.max(x[li], 0));
    var rx = Math.round(Math.min(x[ri], 639))+1;
    var lz = z[li];
    var dzz = (z[ri]-z[li])/(rx-lx);
    for (; lx < rx; lx++, lz+=dzz) {
      if (zbuf[yoff+lx] < lz) {
        fbi[yoff+lx] = color;
        zbuf[yoff+lx] = lz;
      }
    }
  }
}

function swRects(count:number, size:number) {
  while(count--) {
    var color = 0xff000000 | rand256() | (rand256() << 8) | (rand256() << 16);
    rect(color, randi(640), randi(480), randi(size), randi(size));
  }
  ctx.putImageData(data, 0, 0);
}

function swFastRects(count:number, size:number) {
  while(count--) {
    var color = 0xff000000 | rand256() | (rand256() << 8) | (rand256() << 16);
    fast.rect(color, randi(640), randi(480), randi(size), randi(size));
  }
  ctx.putImageData(data, 0, 0); 
}

function swTriangles(count:number, size:number) {
  while(count--) {
    var s = Math.random() * size;
    var color = 0xff000000 | rand256() | (rand256() << 8) | (rand256() << 16);
    var ang = Math.random() * Math.PI * 2;
    var s1 = (Math.sin(ang)*s)|0;
    var c1 = (Math.cos(ang)*s)|0;
    var s2 = (Math.sin(ang+tri)*s)|0;
    var c2 = (Math.cos(ang+tri)*s)|0;
    var s3 = (Math.sin(ang+2*tri)*s)|0;
    var c3 = (Math.cos(ang+2*tri)*s)|0;
    var x = randi(640);
    var y = randi(480);
    triangle(color, [x+s1, y+c1, x+s2, y+c2, x+s3, y+c3]);
  }
  ctx.putImageData(data, 0, 0);
}