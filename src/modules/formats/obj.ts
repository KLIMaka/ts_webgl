import MB = require('../meshbuilder');

export class ObjFile {
  constructor(
    public vtxs:number[][],
    public tcs:number[][],
    public normals:number[][],
    public tris:number[][]
   ) {}
}

export function readObj(file:string):ObjFile {
  var lines = file.split(/\n\r?/);
  var vtxs = [];
  var tcs = [];
  var normals = [];
  var tris = [];
  for (var i = 0, line = lines[i]; i < lines.length; i++, line = lines[i]) {
    if (line.charAt(0) == '#')
      continue;
    var m = line.match(/v +(-?\d+(\.\d+)?) +(-?\d+(\.\d+)?) +(-?\d+(\.\d+)?)( +(-?\d+(\.\d+)?))?/);
    if (m != null) {
      vtxs.push([parseFloat(m[1]), parseFloat(m[3]), parseFloat(m[5]), parseFloat(m[8])]);
      continue;
    }
    m = line.match(/vt +(\d+(\.\d+)?) +(\d+(\.\d+)?)( +(\d+(\.\d+)?))?( +(\d+(\.\d+)?))?/);
    if (m != null) {
      tcs.push([parseFloat(m[1]), parseFloat(m[3]), parseFloat(m[6]), parseFloat(m[9])]);
      continue;
    }
    m = line.match(/vn +(-?\d+(\.\d+)?) +(-?\d+(\.\d+)?) +(-?\d+(\.\d+)?)/);
    if (m != null) {
      normals.push([parseFloat(m[1]), parseFloat(m[3]), parseFloat(m[5])]);
      continue;
    }
    m = line.match(/f (\d+)(\/(\d+)?\/(\d+))? (\d+)(\/(\d+)?\/(\d+))? (\d+)(\/(\d+)?\/(\d+))?/);
    if (m != null) {
      tris.push([
        [parseInt(m[1]), parseInt(m[3]), parseInt(m[4])], 
        [parseInt(m[5]), parseInt(m[7]), parseInt(m[8])], 
        [parseInt(m[9]), parseInt(m[11]), parseInt(m[12])]
       ]);
      continue;
    }
    // console.log('skipping ' + line);
  }
  return new ObjFile(vtxs, tcs, normals, tris);
}

export class ObjData {
  public vertexBuffers;
  public indexBuffer;
  public lengths:number[] = [];
  public offsets:number[] = [];

  constructor(objs:ObjFile[], gl:WebGLRenderingContext) {
    var vtxs = [];
    var normals = [];
    var tcs = [];
    var off = 0;
    for (var o = 0; o < objs.length; o++) {
      var obj = objs[o];
      for (var i = 0; i < obj.tris.length; i++) {
        for (var v = 0; v < 3; v++) {
          var vidx = obj.tris[i][v][0]-1;
          var tidx = obj.tris[i][v][1]-1;
          var nidx = obj.tris[i][v][2]-1;
          vtxs.push(obj.vtxs[vidx][0], obj.vtxs[vidx][1], obj.vtxs[vidx][2]);
          normals.push(obj.normals[nidx][0], obj.normals[nidx][1], obj.normals[nidx][2]);
          tcs.push(obj.tcs[tidx][0], obj.tcs[tidx][1]);
        }
      }
      this.offsets.push(off);
      this.lengths.push(obj.tris.length*3);
      off += obj.tris.length*3*2;
    }

    this.vertexBuffers = {
      'aPos' : MB.wrap(gl, new Float32Array(vtxs), 3, gl.STATIC_DRAW),
      'aNorm' : MB.wrap(gl, new Float32Array(normals), 3, gl.STATIC_DRAW),
      'aTc' : MB.wrap(gl, new Float32Array(tcs), 2, gl.STATIC_DRAW),
    }
    this.indexBuffer = MB.genIndexBuffer(gl, off/2, [0, 1, 2]);
  }
}

export function loadObjs(files:string[], gl:WebGLRenderingContext):ObjData {
  var objFiles = [];
  for (var i = 0; i < files.length; i++) {
    objFiles.push(readObj(files[i]));
  }
  return new ObjData(objFiles, gl);
}