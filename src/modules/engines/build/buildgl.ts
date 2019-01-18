import BW = require('./buildwrapper');
import BS = require('./structs');

export interface BuildRenderer {
	renderWall(board:BW.BoardWrapper, wall:BW.WallWrapper, gl:WebGLRenderingContext);
	renderSector(board:BW.BoardWrapper, sec:BW.SectorWrapper, gl:WebGLRenderingContext);
	renderSprite(board:BW.BoardWrapper, spr:BW.SpriteWrapper, gl:WebGLRenderingContext);
}