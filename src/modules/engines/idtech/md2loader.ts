import D = require('../../../libs/dataviewstream');
import MD2 = require('./md2structs');

export var md2HeaderStruct = D.struct(MD2.Md2Header, [
  ['ident', D.int],
  ['version', D.int],

  ['skinwidth', D.int],
  ['skinheight', D.int],
  ['framesize', D.int],

  ['num_skins', D.int],
  ['num_xyz', D.int],
  ['num_st', D.int],
  ['num_tris', D.int],
  ['num_glcmds', D.int],
  ['num_frames', D.int],

  ['ofs_skins', D.int],
  ['ofs_st', D.int],
  ['ofs_tris', D.int],
  ['ofs_frames', D.int],
  ['ofs_glcmds', D.int],
  ['ofs_end', D.int]
]);

export var vectorStruct = D.struct(MD2.Vector3d, [
  ['x', D.float],
  ['y', D.float],
  ['z', D.float]
]);

export var vertexStruct = D.struct(MD2.Vertex, [
  ['x', D.ubyte],
  ['y', D.ubyte],
  ['z', D.ubyte],
  ['normal_idx', D.ubyte]
]);

export var texCoordStruct = D.struct(MD2.TexCoord, [
  ['u', D.short],
  ['v', D.short]
]);

export var frameStruct = (len:number) => D.struct(MD2.Frame, [
  ['scale', D.array(D.float, 3)],
  ['translate', D.array(D.float, 3)],
  ['name', D.string(16)],
  ['verts', D.array(vertexStruct, len)]
]);

export var triangleStruct = D.struct(MD2.Triangle, [
  ['index_xyz', D.array(D.ushort, 3)],
  ['index_uv', D.array(D.ushort, 2)]
]);

export function loadMd2(stream:D.DataViewStream):MD2.Md2File {
  var header = md2HeaderStruct.read(stream);
  var skins = D.string(header.num_skins*64).read(stream);
  var tcs = D.array(texCoordStruct, header.num_st).read(stream);
  var tris = D.array(triangleStruct, header.num_frames * header.num_tris).read(stream);
  var frames = D.array(frameStruct(header.num_xyz), header.num_frames).read(stream);
  var file = new MD2.Md2File();
  file.header = header;
  file.skins = skins;
  file.tcs = tcs;
  file.tris = tris;
  file.frames = frames;
  return file;
}