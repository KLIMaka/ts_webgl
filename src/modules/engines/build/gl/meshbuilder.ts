import MB = require('../../../meshbuilder');
import DS = require('../../../drawstruct');


export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

var artProvider = null;
export function setArtProvider(p:ArtProvider) {
	artProvider = p;
}

export function init(gl:WebGLRenderingContext) {
	createBuffer(gl);
}

var builder:MB.MeshBuilder = null;
function createBuffer(gl:WebGLRenderingContext) {
	builder = new MB.MeshBuilderConstructor()
		.buffer('aPos', Float32Array, gl.FLOAT, 3)
		.buffer('aNorm', Float32Array, gl.FLOAT, 3)
		.buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
		.buffer('aTc', Float32Array, gl.FLOAT, 2)
		.buffer('aShade', Int8Array, gl.BYTE, 1)
		.index(Uint16Array, gl.UNSIGNED_SHORT)
		.build();

}

export function drawFace(gl:WebGLRenderingContext, picnum:number, verts:number[][], tcs:number[][], idxs:number[], idx:number, shade:number) {

}

