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
    fpsCounter.innerText = dt + ' ms';
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
var vecz = GLM.vec3.create();

var proj = GLM.mat4.clone([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, -0.004, 
  0, 0, 0, 1, 
]);

var tris = [
  [[0xff55aaaa], [-100, -100, -100], [100, -100, -100], [100, 100, -100], [50, -50, -100]],
  [[0xff55aaaa], [-100, -100, -100], [100, 100, -100], [-100, 100, -100], [-50, 50, -100]],
  [[0xffaa55aa], [-100, -100, 100], [100, -100, 100], [100, 100, 100], [50, -50, 100]],
  [[0xffaa55aa], [-100, -100, 100], [100, 100, 100], [-100, 100, 100], [-50, 50, 100]],
  [[0xffaaaa55], [-100, -100, -100], [-100, -100, 100], [100, -100, 100], [-50, -100, 50]],
  [[0xffaaaa55], [-100, -100, -100], [100, -100, 100], [100, -100, -100], [50, -100, -50]],
  [[0xff55aa55], [-100, 100, -100], [-100, 100, 100], [100, 100, 100], [-50, 100, 50]],
  [[0xff55aa55], [-100, 100, -100], [100, 100, 100], [100, 100, -100], [50, 100, -50]],
  [[0xff5555aa], [-100, -100, -100], [-100, -100, 100], [-100, 100, 100], [-100, -50, 50]],
  [[0xff5555aa], [-100, -100, -100], [-100, 100, 100], [-100, 100, -100], [-100, 50, -50]],
  [[0xffaa5555], [100, -100, -100], [100, -100, 100], [100, 100, 100], [100, -50, 50]],
  [[0xffaa5555], [100, -100, -100], [100, 100, 100], [100, 100, -100], [100, 50, -50]],
];

var n = 200;
var poss = new Array(n);
for (var i = 0; i < n; i++)
  poss[i] = [256-rand256()*2, 256-rand256()*2, -rand256(), 1+Math.random()*4];


var ang = 0;
var tri = 2*Math.PI/3;
animate((dt) => {
  // hwFill();
  // swFill();
  // hwNoise();
  // swNoise();
  // hwRects(10000, 200);
  // swRects(10000, 200);
  // swFastRects(10000, 200);
  // swTriangles(100, 50);
  // cube(dt);
  cubes(dt);

});

var sortF = (a:number[], b:number[]) => {return a[0]-b[0];};

function cubes(dt:number) {
  ang += dt;
  swFill(0xffffffff);
  // zbuf.fill(0x8000, 0, 640*480);

  var list = [];
  for (var c = 0; c < poss.length; c++) {
    GLM.mat4.identity(rot);
    GLM.mat4.translate(rot, rot, [320, 240, 0]);
    GLM.mat4.mul(rot, rot, proj);
    GLM.mat4.translate(rot, rot, [poss[c][0], poss[c][1], poss[c][2]]);
    GLM.mat4.rotateY(rot, rot, ang*poss[c][3]);
    GLM.mat4.rotateX(rot, rot, ang*poss[c][3]);
    GLM.mat4.rotateZ(rot, rot, ang*poss[c][3]);
    GLM.mat4.scale(rot, rot, [0.1, 0.1, 0.1]);
    for (var i = 0; i < tris.length; i++) {
      GLM.vec3.transformMat4(vec1, tris[i][1], rot);
      GLM.vec3.transformMat4(vec2, tris[i][2], rot);
      GLM.vec3.transformMat4(vec3, tris[i][3], rot);
      GLM.vec3.transformMat4(vecz, tris[i][4], rot);
      list.push([vecz[2], tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec1[2]|0], [vec2[0]|0, vec2[1]|0, vec2[2]|0], [vec3[0]|0, vec3[1]|0, vec3[2]|0]]);
      // triangleZ(tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec1[2]|0, vec2[0]|0, vec2[1]|0, vec2[2]|0, vec3[0]|0, vec3[1]|0, vec3[2]|0]);
      // triangle(tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec2[0]|0, vec2[1]|0, vec3[0]|0, vec3[1]|0]);
    }
  }

debugger;
  list.sort(sortF);
  for (var i = 0; i < list.length; i++) {
    triangleZ(list[i][1], list[i][2], list[i][3], list[i][4]);
  }
  ctx.putImageData(data, 0, 0);
}

function cube(dt:number) {
  ang += dt/2;
  swFill(0xffffffff);
  GLM.mat4.identity(rot);
  GLM.mat4.translate(rot, rot, [320, 240, 0]);
  GLM.mat4.mul(rot, rot, proj);
  // GLM.mat4.rotateY(rot, rot, ang);
  // GLM.mat4.rotateX(rot, rot, ang);
  GLM.mat4.rotateZ(rot, rot, ang);
  GLM.mat4.scale(rot, rot, [0.5, 0.5, 0.5]);
  var list = [];
  for(var i = 0; i < tris.length; i++) {
    GLM.vec3.transformMat4(vec1, tris[i][1], rot);
    GLM.vec3.transformMat4(vec2, tris[i][2], rot);
    GLM.vec3.transformMat4(vec3, tris[i][3], rot);
    GLM.vec3.transformMat4(vecz, tris[i][4], rot);
    list.push([vecz[2], tris[i][0][0], [vec1[0]|0, vec1[1]|0, vec1[2]|0], [vec2[0]|0, vec2[1]|0, vec2[2]|0], [vec3[0]|0, vec3[1]|0, vec3[2]|0]]);
  }
  list.sort((a:number[], b:number[]) => {return a[0]-b[0];})
  for (var i = 0; i < list.length; i++) {
    triangleZ(list[i][1], list[i][2], list[i][3], list[i][4]);
  }
  ctx.putImageData(data, 0, 0);
}

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

function swap(arr:any[], i:number, j:number):void {
  var tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function sort(p1:number[], p2:number[], p3:number[]):number[][] {
  var r = [p1, p2, p3];
  if (r[1][1] <= r[0][1] && r[1][1] <= r[2][1]) swap(r, 0, 1);
  if (r[2][1] <= r[0][1] && r[2][1] <= r[1][1]) swap(r, 0, 2);
  if (r[2][1] < r[1][1]) swap(r, 1, 2);
  if (r[2][0] < r[1][0]) swap(r, 1, 2);
  return r;
}

function triangle1(color:number, p1:number[], p2:number[], p3:number[]):void {
  var tri = sort(p1, p2, p3);
  var miny = tri[0][1];
  var dxl = tri[1][0]-tri[0][0];
  var dxr = tri[2][0]-tri[0][0];
  var dyl = tri[1][1]-tri[0][1];
  var dyr = tri[2][1]-tri[0][1];
  var dl = dyl/dxl;
  var dr = dyr/dxr;
  for (var y = miny;;) {
    var lx = tri[1][0];
    if (dl < 0) lx += (0.5/-dl)|0;
    var rx = tri[2][0];
    if (dr > 0) rx += (0.5/dr)|0;
  }
}

function delata(p1:number[], p2:number[], p3:number[], attrsCount:number):number[][] {
  var d = new Array(attrsCount);
  for (var i = 0; i < attrsCount; i++)
    d[i] = [p1[i]-p2[i], p2[i]-p3[i], p3[i]-p1[i]];
  return d;
}

function range(s:number[], x:number[]):number[] {
  var idxs = [0, 0, 0];
  var i = 0;
  if (s[0] <= 0) idxs[i++] = 0;
  if (s[1] <= 0) idxs[i++] = 1;
  if (s[2] <= 0) idxs[i++] = 2;
  if (i == 2) {
    var li = x[idxs[0]] < x[idxs[1]] ? idxs[0] : idxs[1];
    var ri = x[idxs[0]] < x[idxs[1]] ? idxs[1] : idxs[0];
  } else {
    var li = x[idxs[0]] < x[idxs[1]] ? x[idxs[0]] < x[idxs[2]] ? idxs[0] : idxs[2] : x[idxs[1]] < x[idxs[2]] ? idxs[1] : idxs[2];
    var ri = x[idxs[0]] > x[idxs[1]] ? x[idxs[0]] > x[idxs[2]] ? idxs[0] : idxs[0] : x[idxs[1]] > x[idxs[2]] ? idxs[1] : idxs[2];
  }
  return [li, ri];
}

function line(y:number, p1:number[], p2:number[], p3:number[], d:number[][], attrsCount:number) {
  var s = [y-p1[1], y-p2[1], y-p3[1]];
  var k = [s[0]/d[1][0], s[1]/d[1][1], s[2]/d[1][2]];
  var attrs = new Array(attrsCount);
  for( var a = 0; a < attrsCount; a++) 
    attrs[a] = [p1[a]+k[0]*d[a][0], p2[a]+k[1]*d[a][1], p3[a]+k[2]*d[a][2]];
  var ss = [s[0]*s[1], s[1]*s[2], s[2]*s[0]];
  var lr = range(ss, attrs[0]);
  return {
    attrs:attrs,
    li:lr[0],
    ri:lr[1],
  }
}

function maxmins(p1:number[], p2:number[], p3:number[]):number[] {
  return [
    Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0]),
    Math.min(p2[0], p3[0]), Math.max(p2[0], p3[0]),
    Math.min(p3[0], p1[0]), Math.max(p3[0], p1[0]),
  ];
}

function triangleZ(color:number, p1:number[], p2:number[], p3:number[]) {
  var maxy = Math.min(Math.max(p1[1], p2[1], p3[1]), 480);
  var miny = Math.max(Math.min(p1[1], p2[1], p3[1]), 0);
  var d = delata(p1, p2, p3, 3);
  var mm = maxmins(p1, p2, p3);
  var ang = [d[0][0]/d[1][0], d[0][1]/d[1][1], d[0][2]/d[1][2]];
  var padd = [Math.abs(ang[0]/2)|0, Math.abs(ang[1]/2)|0, Math.abs(ang[2]/2)|0];
  for(var y = miny; y <= maxy; y++) {
    var l = line(y, p1, p2, p3, d, 3);
    var x = l.attrs[0];
    var li = l.li;
    var ri = l.ri;
    var z = l.attrs[2];
    var yoff = y*640;
    var lx = Math.round(Math.max(x[li]-padd[li], mm[li*2]));
    var rx = Math.round(Math.min(x[ri]+padd[ri], mm[ri*2+1]))+1;
    var lz = z[li];
    var dzz = (z[ri]-z[li])/(rx-lx);
    for (; lx < rx; lx++, lz+=dzz) {
      // if (zbuf[yoff+lx] <= lz) {
        // var zz =(lz+200)&0xff;
        // if (zz > 180){
        //   if ((y&1)&(lx&1))
        //     fbi[yoff+lx] = color;
        // } else if (zz > 130) {
        //   if ((y&1)^(lx&1))
        //     fbi[yoff+lx] = color;
        // } else {
        //     fbi[yoff+lx] = color;
        // }
        // if ((y&1)&(lx&1))
        fbi[yoff+lx] = color;
        // fbi[yoff+lx] = 0xff000000 | ((lz+200)&0xff);
        // zbuf[yoff+lx] = lz;
      // }
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