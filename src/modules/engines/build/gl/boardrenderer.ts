import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as INPUT from '../../../input';
import * as PROFILE from '../../../../modules/profiler';
import { Texture } from '../../../drawstruct';
import * as TEX from '../../../textures';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import { Board, Sprite } from '../structs';
import * as U from '../utils';
import * as BUFF from './buffers';
import * as BGL from './buildgl';
import { ArtProvider, Cache } from './cache';
import { Renderable, Type, Solid, wrapInGrid } from './renderable';
import { BloodSprite } from '../bloodstructs';
import { loadImage } from '../../../../libs/imgutils';
import { ObjectVector } from '../../../vector';


export interface PalProvider extends ArtProvider {
  getPalTexture(): Texture;
  getPluTexture(): Texture;
}

function isUpperLink(spr: Sprite) {
  return spr.lotag == 11 || spr.lotag == 7 || spr.lotag == 9 || spr.lotag == 13;
}

function isLowerLink(spr: Sprite) {
  return spr.lotag == 12 || spr.lotag == 6 || spr.lotag == 10 || spr.lotag == 14;
}



let ceilingLinks = {}
let floorLinks = {}

function initRorLinks(board: Board) {
  let linkRegistry = {};
  for (let s = 0; s < board.sprites.length; s++) {
    let spr = board.sprites[s];
    if (isUpperLink(spr) || isLowerLink(spr)) {
      let id = (<BloodSprite>spr).extraData.data1;
      let links = linkRegistry[id];
      if (links == undefined) {
        links = [];
        linkRegistry[id] = links;
      }
      links.push(s);
    }
  }

  for (let linkId in linkRegistry) {
    let spriteIds = linkRegistry[linkId];
    if (spriteIds.length != 2)
      throw new Error('Invalid link in sprites: ' + spriteIds);
    let [s1, s2] = spriteIds;
    let spr1 = board.sprites[s1];
    let spr2 = board.sprites[s2];
    if (!isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (board.sectors[spr1.sectnum].floorpicnum == 504)
      floorLinks[spr1.sectnum] = [s1, s2];
    if (board.sectors[spr2.sectnum].ceilingpicnum == 504)
      ceilingLinks[spr2.sectnum] = [s2, s1];
  }
}

function loadGridTexture(gl: WebGLRenderingContext, cb: (gridTex: Texture) => void): void {
  loadImage('resources/engines/blood/grid.png', (w: number, h: number, img: Uint8Array) => {
    let gridTexture = TEX.createTexture(w, h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, img, gl.RGBA);
    gl.bindTexture(gl.TEXTURE_2D, gridTexture.get());
    gl.generateMipmap(gl.TEXTURE_2D);
    cb(gridTexture);
  });
}

let artProvider: PalProvider;
let cache: Cache;
export function init(gl: WebGLRenderingContext, art: PalProvider, board: Board, cb: () => void) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  artProvider = art;
  cache = new Cache(board, art);
  initRorLinks(board);
  loadGridTexture(gl, (gridTex: Texture) => BGL.init(gl, art.getPalTexture(), art.getPluTexture(), gridTex, cb));
}

let selectType = -1;
let selectId = -1;
let gridSize = 128;

function print(board: Board, id: number, type: U.HitType) {
  if (INPUT.mouseClicks[0]) {
    switch (type) {
      case U.HitType.CEILING:
      case U.HitType.FLOOR:
        console.log(id, board.sectors[id]);
        break;
      case U.HitType.UPPER_WALL:
      case U.HitType.MID_WALL:
      case U.HitType.LOWER_WALL:
        console.log(id, board.walls[id]);
        break;
      case U.HitType.SPRITE:
        console.log(id, board.sprites[id]);
        break;
    }
  }
}

let hit = new U.Hitscan();
function hitscan(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  let [vx, vz, vy] = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
  if (hit.t == -1) {
    selectType = -1;
    selectId = -1;
  } else {
    selectType = hit.type;
    selectId = hit.id;
    print(board, selectId, selectType);
  }
}

function getClosestWall(board: Board): number {
  if (hit.t == -1)
    return -1;
  if (U.isWall(hit.type)) {
    return BU.closestWallInSector(board, U.sectorOfWall(board, hit.id), hit.x, hit.y, 64);
  } else if (U.isSector(hit.type)) {
    return BU.closestWallInSector(board, hit.id, hit.x, hit.y, 64);
  }
  return -1;
}

let movingz = 0;
let movingId = -1;
function move(gl: WebGLRenderingContext, board: Board, ctr: Controller3D) {
  let w = movingId == -1 ? getClosestWall(board) : movingId;
  if (w == -1) {
    BGL.setCursorPosiotion([0, 0, 0]);
    return;
  }

  BGL.setCursorPosiotion([board.walls[w].x, hit.z / -16, board.walls[w].y]);
  if (movingId == -1 && INPUT.mouseButtons[0]) {
    movingId = w;
    movingz = hit.z;
  }
  if (!INPUT.mouseButtons[0]) {
    movingId = -1;
  }

  if (movingId == -1)
    return;

  let fwd = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  let pos = ctr.getCamera().getPosition();
  let dz = movingz / -16 - pos[1];
  let t = dz / fwd[1];
  GLM.vec3.scale(fwd, fwd, t);
  let x = pos[0] + fwd[0];
  let y = pos[2] + fwd[2]
  BU.moveWall(board, movingId, snapGrid(x, gridSize), snapGrid(y, gridSize));
  cache.invalidateAll();
}

function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

function snap(board: Board) {
  if (hit.t != -1) {
    // let x = hit.x; let y = hit.y;
    // if (U.isSector(hit.type)) {
    //   x = snapGrid(x, gridSize);
    //   y = snapGrid(y, gridSize);
    // } else if (U.isWall(hit.type)) {
    //   let w = hit.id; 
    //   let wall = board.walls[w];
    //   let w1 = BU.nextwall(board, w); let wall1 = board.walls[w1];
    //   let dx = wall1.x - wall.x;
    //   let dy = wall1.y - wall.y;
    //   let repeat = 128 * wall.xrepeat;
    //   let dt = gridSize / repeat;
    //   let dxt = x - wall.x; let dyt = y - wall.y;
    //   let t = MU.len2d(dxt, dyt) / MU.len2d(dx, dy);
    //   t = (1 - t) < dt/2.0 ? 1 : snapGrid(t, dt);
    //   x = MU.int(wall.x + (t * dx));
    //   y = MU.int(wall.y + (t * dy));
    // }
    BGL.setCursorPosiotion([hit.x, hit.z / -16, hit.y]);
  }
}

export function draw(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  BGL.newFrame(gl);
  drawImpl(gl, board, ms, ctr);

  hitscan(gl, board, ms, ctr);
  move(gl, board, ctr);
  drawHelpers(gl, board);
  // snap(board);

  highlightSelected(gl, board);

  if (U.isWall(selectType) && INPUT.keys['M']) {
    board.walls[selectId].picnum = 504;
    cache.invalidateWalls([selectId]);
  }
  if (U.isSector(selectType) && INPUT.keys['G']) {
    board.sectors[selectId].floorxpanning = (board.sectors[selectId].floorxpanning + 16) % 256;
    cache.invalidateSectors([selectId]);
  }
  if (U.isSector(selectType) && INPUT.keys['H']) {
    board.sectors[selectId].floorypanning = (board.sectors[selectId].floorypanning + 16) % 256;
    cache.invalidateSectors([selectId]);
  }
}

function drawHelpers(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  if (movingId != -1) {
    let s = U.sectorOfWall(board, movingId);
    drawHelperPlane(gl, board, movingId, s, U.HitType.UPPER_WALL);
    drawHelperPlane(gl, board, movingId, s, U.HitType.MID_WALL);
    drawHelperPlane(gl, board, movingId, s, U.HitType.LOWER_WALL);
    let point2 = board.walls[movingId].point2;
    drawHelperPlane(gl, board, point2, s, U.HitType.UPPER_WALL);
    drawHelperPlane(gl, board, point2, s, U.HitType.MID_WALL);
    drawHelperPlane(gl, board, point2, s, U.HitType.LOWER_WALL);
    drawHelperPlane(gl, board, s, -1, U.HitType.CEILING);
    drawHelperPlane(gl, board, s, -1, U.HitType.FLOOR);
  } else if (hit.t != -1 && U.isSector(hit.type)) {
    drawHelperPlane(gl, board, hit.id, -1, hit.type);
  } else if (hit.t != -1 && U.isWall(hit.type)) {
    let s = U.sectorOfWall(board, hit.id);
    drawHelperPlane(gl, board, hit.id, s, hit.type);
  }
  gl.enable(gl.DEPTH_TEST);
}

let texMat = GLM.mat4.create();
let tmp = GLM.vec4.create();
function gridMatrix(board: Board, id: number, type: U.HitType): GLM.Mat4Array {
  GLM.mat4.identity(texMat);
  if (U.isSector(type)) {
    GLM.vec4.set(tmp, 1 / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateX(texMat, texMat, Math.PI / 2);
  } else if (U.isWall(type)) {
    let wall1 = board.walls[id];
    let wall2 = board.walls[wall1.point2];
    let dx = wall2.x - wall1.x;
    let dy = wall2.y - wall1.y;
    let d = 128 / (BU.walllen(board, id) / wall1.xrepeat);
    GLM.vec4.set(tmp, d / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
    // GLM.vec4.set(tmp, -wall1.x, 0, -wall1.y, 0);
    // GLM.mat4.translate(texMat, texMat, tmp);
  }
  return texMat;
}

function drawHelperPlane(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: U.HitType) {
  let r = <Solid>cache.getByIdType(id, addId, type);
  BGL.draw(gl, wrapInGrid(r, gridMatrix(board, id, type)));
}

function highlightSelected(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  BGL.draw(gl, cache.getByIdType(selectId, U.isWall(selectType) ? U.sectorOfWall(board, selectId) : -1, selectType, true));
  if (U.isSector(selectType)) {
    let sec = board.sectors[selectId];
    let start = sec.wallptr;
    let end = sec.wallptr + sec.wallnum;
    let slope = U.createSlopeCalculator(sec, board.walls);
    let z = selectType == U.HitType.CEILING ? sec.ceilingz : sec.floorz;
    let heinum = selectType == U.HitType.CEILING ? sec.ceilingheinum : sec.floorheinum;
    for (let w = start; w < end; w++) {
      let wall = board.walls[w];
      let zz = (slope(wall.x, wall.y, heinum) + z) / -16;
      BGL.draw(gl, cache.getWallPoint(w, 32, zz));
    }
  } else if (U.isWall(selectType)) {
    let s = U.sectorOfWall(board, selectId);
    let sec = board.sectors[s];
    let wall = board.walls[selectId];
    let wall1 = board.walls[wall.point2];
    let slope = U.createSlopeCalculator(sec, board.walls);
    let zf1 = (slope(wall.x, wall.y, sec.floorheinum) + sec.floorz) / -16;
    let zf2 = (slope(wall1.x, wall1.y, sec.floorheinum) + sec.floorz) / -16;
    let zc1 = (slope(wall.x, wall.y, sec.ceilingheinum) + sec.ceilingz) / -16;
    let zc2 = (slope(wall1.x, wall1.y, sec.ceilingheinum) + sec.ceilingz) / -16;
    BGL.draw(gl, cache.getWallPoint(selectId, 32, zf1));
    BGL.draw(gl, cache.getWallPoint(selectId, 32, zc1));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, zf2));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, zc2));
  }
  gl.enable(gl.DEPTH_TEST);
}

function writeStencilOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.ALWAYS, value, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.EQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeDepthOnly(gl: WebGLRenderingContext) {
  gl.colorMask(false, false, false, false);
}

function writeAll(gl: WebGLRenderingContext) {
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

let all = new VIS.AllBoardVisitorResult();
let visible = new VIS.PvsBoardVisitorResult();
function drawImpl(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

  PROFILE.startProfile('processing');
  let result = ms.sec == -1
    ? all.visit(board)
    : visible.visit(board, ms);
  PROFILE.endProfile();

  BGL.setProjectionMatrix(ctr.getProjectionMatrix(gl));
  drawMirrors(gl, board, result, ms, ctr);
  drawRor(gl, board, result, ms, ctr);

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  drawRooms(gl, board, result);
}

let additionVisible = new VIS.PvsBoardVisitorResult();
let diff = GLM.vec3.create();
let stackTransform = GLM.mat4.create();
let mstmp = new U.MoveStruct();
let srcPos = GLM.vec3.create();
let dstPos = GLM.vec3.create();
let npos = GLM.vec3.create();

function drawStack(gl: WebGLRenderingContext, board: Board, ctr: Controller3D, src: Sprite, dst: Sprite, surface: Renderable, stencilValue: number) {
  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeStencilOnly(gl, stencilValue);
  BGL.draw(gl, surface);

  GLM.vec3.set(srcPos, src.x, src.z / -16, src.y);
  GLM.vec3.set(dstPos, dst.x, dst.z / -16, dst.y);
  GLM.vec3.sub(diff, srcPos, dstPos);
  GLM.mat4.copy(stackTransform, ctr.getCamera().getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);
  GLM.vec3.sub(npos, ctr.getCamera().getPosition(), diff);

  mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1];
  BGL.setViewMatrix(stackTransform);
  BGL.setPosition(npos);
  writeStenciledOnly(gl, stencilValue);
  drawRooms(gl, board, additionVisible.visit(board, mstmp));

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeDepthOnly(gl);
  BGL.draw(gl, surface);
}

let rorSectorCollector = VIS.createSectorCollector((board: Board, sectorId: number) => floorLinks[sectorId] != undefined || ceilingLinks[sectorId] != undefined);
function drawRor(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forSector(rorSectorCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    let s = rorSectorCollector.sectors.get(i);
    let r = cache.getSector(s);

    if (ceilingLinks[s] != undefined) {
      let src = board.sprites[ceilingLinks[s][0]];
      let dst = board.sprites[ceilingLinks[s][1]];
      drawStack(gl, board, ctr, src, dst, r.ceiling, i + 1);
    }
    if (floorLinks[s] != undefined) {
      let src = board.sprites[floorLinks[s][0]];
      let dst = board.sprites[floorLinks[s][1]];
      drawStack(gl, board, ctr, src, dst, r.floor, i + 1);
    }
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

let mirrorWallsCollector = VIS.createWallCollector((board: Board, wallId: number, sectorId: number) => board.walls[wallId].picnum == 504);
let msMirrored = new U.MoveStruct();
let wallNormal = GLM.vec2.create();
let mirrorNormal = GLM.vec3.create();
let mirroredTransform = GLM.mat4.create();
let mpos = GLM.vec3.create();

function drawMirrors(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forWall(mirrorWallsCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < mirrorWallsCollector.walls.length(); i++) {
    let w = VIS.unpackWallId(mirrorWallsCollector.walls.get(i));
    let w1 = board.walls[w];
    let w2 = board.walls[w1.point2];
    if (!U.wallVisible(w1, w2, ms))
      continue;

    // draw mirror surface into stencil
    let r = cache.getWall(w, mirrorWallsCollector.walls[i].sectorId);
    BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
    BGL.setPosition(ctr.getCamera().getPosition());
    writeStencilOnly(gl, i + 127);
    BGL.draw(gl, r);

    // draw reflections in stenciled area
    GLM.vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
    VEC.normal2d(wallNormal, wallNormal);
    GLM.vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
    let mirrorrD = -MU.dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    VEC.mirrorBasis(mirroredTransform, ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition(), mirrorNormal, mirrorrD);

    BGL.setViewMatrix(mirroredTransform);
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    gl.cullFace(gl.FRONT);
    GLM.vec3.set(mpos, ms.x, ms.z, ms.y);
    VEC.reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
    msMirrored.sec = ms.sec; msMirrored.x = mpos[0]; msMirrored.y = mpos[2]; msMirrored.z = mpos[1];
    writeStenciledOnly(gl, i + 127);
    drawRooms(gl, board, additionVisible.visit(board, msMirrored));
    gl.cullFace(gl.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
    writeDepthOnly(gl);
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(gl, r);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

function drawArray(gl: WebGLRenderingContext, arr: ObjectVector) {
  for (let i = 0; i < arr.length(); i++) {
    BGL.draw(gl, arr.get(i));
  }
}

let surfaces = new ObjectVector();
let surfacesTrans = new ObjectVector();
let sprites = new ObjectVector();
let spritesTrans = new ObjectVector();
function drawRooms(gl: WebGLRenderingContext, board: Board, result: VIS.Result) {
  PROFILE.startProfile('processing');
  surfaces.clear();
  surfacesTrans.clear();
  sprites.clear();
  spritesTrans.clear();

  result.forSector((board: Board, sectorId: number) => {
    let sector = cache.getSector(sectorId);
    if (floorLinks[sectorId] == undefined)
      surfaces.push(sector.floor);
    if (ceilingLinks[sectorId] == undefined)
      surfaces.push(sector.ceiling);
    PROFILE.incCount('sectors');
  });
  result.forWall((board: Board, wallId: number, sectorId: number) => {
    if (board.walls[wallId].picnum == 504)
      return;
    let wall = cache.getWall(wallId, sectorId);
    if (wall.mid.trans != 1) {
      surfacesTrans.push(wall.mid);
      surfaces.push(wall.bot);
      surfaces.push(wall.top);
    } else {
      surfaces.push(wall);
    }
    PROFILE.incCount('walls');
  });
  result.forSprite((board: Board, spriteId: number) => {
    let sprite = cache.getSprite(spriteId);
    let trans = sprite.trans != 1;
    (sprite.type == Type.FACE
      ? (trans ? spritesTrans : sprites)
      : (trans ? spritesTrans : sprites))
      .push(sprite);
    PROFILE.incCount('sprites');
  });
  PROFILE.set('buffer', BUFF.getFreeSpace());
  PROFILE.endProfile();

  PROFILE.startProfile('draw');

  drawArray(gl, surfaces);

  gl.polygonOffset(-1, -8);
  drawArray(gl, sprites);
  gl.polygonOffset(0, 0);

  drawArray(gl, surfacesTrans);

  gl.polygonOffset(-1, -8);
  drawArray(gl, spritesTrans);
  gl.polygonOffset(0, 0);

  PROFILE.endProfile();
}