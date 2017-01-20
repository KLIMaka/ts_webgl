
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

    console.log('skipping ' + line);
  }
  return new ObjFile(vtxs, tcs, normals, tris);
}