import { loadImage } from '../../../../libs/imgutils';
import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import { Texture } from '../../../drawstruct';
import * as INPUT from '../../../input';
import * as TEX from '../../../textures';
import { NumberVector, ObjectVector } from '../../../vector';
import * as BLOOD from '../bloodutils';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import { Board } from '../structs';
import * as U from '../utils';
import * as BUFF from './buffers';
import * as BGL from './buildgl';
import { ArtProvider, Cache } from './cache';
import { Renderable, Solid, Type, wrapInGrid } from './renderable';


export interface PalProvider extends ArtProvider {
  getPalTexture(): Texture;
  getPluTexture(): Texture;
}

function loadGridTexture(gl: WebGLRenderingContext, cb: (gridTex: Texture) => void): void {
  loadImage('resources/grid.png', (w: number, h: number, img: Uint8Array) => {
    cb(TEX.createTexture(w, h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, img, gl.RGBA));
  });
}

let artProvider: PalProvider;
let cache: Cache;
let rorLinks: BLOOD.RorLinks;
export function init(gl: WebGLRenderingContext, art: PalProvider, board: Board, cb: () => void) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  artProvider = art;
  cache = new Cache(board, art);
  rorLinks = BLOOD.loadRorLinks(board);
  loadGridTexture(gl, (gridTex: Texture) => BGL.init(gl, art.getPalTexture(), art.getPluTexture(), gridTex, cb));
}

interface Editable {
  canMove(): boolean;
  start(board: Board): void;
  move(board: Board, handle: MovingHandle): void;
  end(board: Board): void;
  highlight(gl: WebGLRenderingContext, board: Board): void;
}

let connectedWalls = new NumberVector();
class WallEditable implements Editable {
  private origin = GLM.vec3.create();
  private active = false;

  constructor(private wallId: number) { }
  public canMove(): boolean { return true }

  public start(board: Board): void {
    let wall = board.walls[this.wallId];
    GLM.vec3.set(this.origin, wall.x, 0, wall.y);
    this.active = true;
  }

  public move(board: Board, handle: MovingHandle) {
    let x = snapGrid(this.origin[0] + handle.dx(), gridSize);
    let y = snapGrid(this.origin[2] + handle.dy(), gridSize);
    if (BU.moveWall(board, this.wallId, x, y))
      cache.invalidateAll();
  }

  public end(board: Board): void {
    this.active = false;
  }

  public highlight(gl: WebGLRenderingContext, board: Board) {
    if (this.active) {
      BU.connectedWalls(board, this.wallId, connectedWalls.clear());
      for (let i = 0; i < connectedWalls.length(); i++) {
        let w = connectedWalls.get(i);
        let s = U.sectorOfWall(board, w);
        highlightWall(gl, board, w, s);
        let p = BU.prevwall(board, w);
        highlightWall(gl, board, p, s);
        highlightSector(gl, board, s);
      }
    } else {
      let s = U.sectorOfWall(board, this.wallId);
      highlightWall(gl, board, this.wallId, s);
    }
  }
}
function editableWall(wallId: number) {
  return new WallEditable(wallId);
}

class SpriteEditable implements Editable {
  private origin = GLM.vec3.create();

  constructor(private spriteId: number) { }
  public canMove(): boolean { return true }

  public start(board: Board): void {
    let spr = board.sprites[this.spriteId];
    GLM.vec3.set(this.origin, spr.x, spr.z / -16, spr.y);
  }

  public move(board: Board, handle: MovingHandle) {
    let x = snapGrid(this.origin[0] + handle.dx(), gridSize);
    let y = snapGrid(this.origin[2] + handle.dy(), gridSize);
    let z = snapGrid(this.origin[1] + handle.dz(), gridSize) * -16;
    if (BU.moveSprite(board, this.spriteId, x, y, z)) {
      cache.invalidateAll();
    }
  }

  public end(board: Board): void {
  }

  public highlight(gl: WebGLRenderingContext, board: Board) {
    highlightSprite(gl, board, this.spriteId);
  }
}
function editableSprite(wallId: number) {
  return new SpriteEditable(wallId);
}

class SectorEditable implements Editable {
  private originz = 0;

  constructor(private sectorId: number, private type: U.HitType) { }
  public canMove(): boolean { return true }

  public highlight(gl: WebGLRenderingContext, board: Board) {
    highlight(gl, board, this.sectorId, -1, this.type);
  }

  public start(board: Board): void {
    let sec = board.sectors[this.sectorId];
    this.originz = (this.type == U.HitType.CEILING ? sec.ceilingz : sec.floorz) / -16;
  }
  
  public move(board: Board, handle: MovingHandle) {
    let z = snapGrid(this.originz + handle.dz(), gridSize) * -16;
    let sec = board.sectors[this.sectorId];
    if (this.type == U.HitType.CEILING) {
      if (sec.ceilingz != z) {
        sec.ceilingz = z;
        cache.invalidateAll();
      }
    } else {
      if (sec.floorz != z) {
        sec.floorz = z;
        cache.invalidateAll();
      }
    }
  }

  public end(board: Board): void {
  }
}
function editableSector(sectorId: number, type:U.HitType) {
  return new SectorEditable(sectorId, type);
}

function getUnderCursor(board: Board): Editable[] {
  let w = getClosestWall(board);
  if (w != -1) {
    return [editableWall(w)];
  } else if (U.isWall(hit.type)) {
    let w1 = board.walls[hit.id].point2;
    return [editableWall(hit.id), editableWall(w1)];
  } else if (U.isSector(hit.type)) {
    return [editableSector(hit.id, hit.type)];
  } else if (U.isSprite(hit.type)) {
    return [editableSprite(hit.id)];
  } else {
    return null;
  }
}


class Selection {
  private items = new ObjectVector<Editable>();

  public move(board: Board, handle: MovingHandle) {
    for (let i = 0; i < this.items.length(); i++) {
      if (!this.items.get(i).canMove())
        return;
    }

    for (let i = 0; i < this.items.length(); i++) {
      this.items.get(i).move(board, handle);
    }
  }

  public startMove(board: Board) {
    for (let i = 0; i < this.items.length(); i++) {
      this.items.get(i).start(board);
    }
  }

  public endMove(board: Board) {
    for (let i = 0; i < this.items.length(); i++) {
      this.items.get(i).end(board);
    }
  }

  public add(items: Editable[]) {
    if (items == null)
      return;
    for (let i = 0; i < items.length; i++) {
      this.items.push(items[i]);
    }
  }

  public clear() {
    this.items.clear();
  }

  public isEmpty() {
    return this.items.length() == 0;
  }

  public highlight(gl: WebGLRenderingContext, board: Board) {
    for (let i = 0; i < this.items.length(); i++) {
      this.items.get(i).highlight(gl, board);
    }
  }

}


class MovingHandle {
  private startPoint = GLM.vec3.create();
  private currentPoint = GLM.vec3.create();
  private dzoff = 0;
  private active = false;
  private parallel = false;
  private elevate = false;

  public start(x: number, y: number, z: number) {
    GLM.vec3.set(this.startPoint, x, y, z);
    GLM.vec3.set(this.currentPoint, x, y, z);
    this.dzoff = 0;
    this.active = true;
  }

  public update(s: GLM.Vec3Array, v: GLM.Vec3Array, elevate: boolean, parallel: boolean) {
    this.parallel = parallel;
    this.elevate = elevate;
    if (elevate) {
      let dx = this.currentPoint[0] - s[0];
      let dy = this.currentPoint[2] - s[2];
      let t = MU.len2d(dx, dy) / MU.len2d(v[0], v[2]);
      this.dzoff = v[1] * t + s[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      let dz = this.startPoint[1] - s[1];
      let t = dz / v[1];
      GLM.vec3.set(this.currentPoint, v[0], v[1], v[2]);
      GLM.vec3.scale(this.currentPoint, this.currentPoint, t);
      GLM.vec3.add(this.currentPoint, this.currentPoint, s);
    }
  }

  public isActive() {
    return this.active;
  }

  public stop() {
    this.active = false;
  }

  public dx() {
    let dx = this.currentPoint[0] - this.startPoint[0];
    if (this.parallel) {
      let dy = this.currentPoint[2] - this.startPoint[2];
      return Math.abs(dx) > Math.abs(dy) ? dx : 0;
    }
    return dx;
  }
  
  public dy() {
    let dy = this.currentPoint[2] - this.startPoint[2];
    if (this.parallel) {
      let dx = this.currentPoint[0] - this.startPoint[0];
      return Math.abs(dy) > Math.abs(dx) ? dy : 0;
    }
    return dy;
  }

  public dz() {
    return this.elevate ? this.currentPoint[1] - this.startPoint[1] + this.dzoff : 0;
  }
}

let gridSize = 128;
let selection = new Selection();
let handle = new MovingHandle();

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
}

function getClosestWall(board: Board): number {
  if (U.isWall(hit.type)) {
    return BU.closestWallInSector(board, U.sectorOfWall(board, hit.id), hit.x, hit.y, 64);
  } else if (U.isSector(hit.type)) {
    return BU.closestWallInSector(board, hit.id, hit.x, hit.y, 64);
  }
  return -1;
}

function move(gl: WebGLRenderingContext, board: Board, ctr: Controller3D) {
  if (selection.isEmpty())
    return;

  if (!handle.isActive() && INPUT.mouseButtons[0]) {
    handle.start(hit.x, hit.z / -16, hit.y);
    selection.startMove(board);
  } else if (!INPUT.mouseButtons[0]) {
    handle.stop();
    selection.endMove(board);
    return;
  }

  let fwd = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  let pos = ctr.getCamera().getPosition();
  handle.update(pos, fwd, INPUT.keys['ALT'], INPUT.keys['SHIFT']);
  selection.move(board, handle);
}

function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

let snappedX: number;
let snappedY: number;
function snap(board: Board) {
  if (hit.t != -1) {
    let x = hit.x; let y = hit.y;
    if (U.isSector(hit.type)) {
      x = snapGrid(x, gridSize);
      y = snapGrid(y, gridSize);
    } else if (U.isWall(hit.type)) {
      let w = hit.id;
      let wall = board.walls[w];
      let w1 = BU.nextwall(board, w); let wall1 = board.walls[w1];
      let dx = wall1.x - wall.x;
      let dy = wall1.y - wall.y;
      let repeat = 128 * wall.xrepeat;
      let dt = gridSize / repeat;
      let dxt = x - wall.x; let dyt = y - wall.y;
      let t = MU.len2d(dxt, dyt) / MU.len2d(dx, dy);
      t = (1 - t) < dt / 2.0 ? 1 : snapGrid(t, dt);
      x = MU.int(wall.x + (t * dx));
      y = MU.int(wall.y + (t * dy));
    }
    snappedX = x; snappedY = y;
    BGL.setCursorPosiotion(x, hit.z / -16, y);
  }
}

function select(board: Board) {
  if (handle.isActive())
    return;

  if (INPUT.mouseClicks[0]) {
    selection.clear();
    selection.add(getUnderCursor(board));
  }
}

export function draw(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  hitscan(gl, board, ms, ctr);
  move(gl, board, ctr);
  select(board)
  snap(board);

  // if (U.isWall(selectType) && INPUT.keys['M']) {
  //   board.walls[selectId].picnum = BLOOD.MIRROR_PIC;
  //   cache.invalidateWalls([selectId]);
  // }
  // if (U.isWall(selectType) && INPUT.keys['INSERT']) {
  //   BU.splitWall(board, hit.id, snappedX, snappedY, artProvider, []);
  //   cache.invalidateAll();
  // }

  BGL.newFrame(gl);
  drawImpl(gl, board, ms, ctr);
  drawHelpers(gl, board);
}

function drawHelpers(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  selection.highlight(gl, board);
  gl.enable(gl.DEPTH_TEST);
}

function highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number) {
  drawGrid(gl, board, sectorId, -1, U.HitType.CEILING);
  drawGrid(gl, board, sectorId, -1, U.HitType.FLOOR);
  drawEdges(gl, board, sectorId, -1, U.HitType.CEILING);
  drawEdges(gl, board, sectorId, -1, U.HitType.FLOOR);
}

function highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number) {
  drawGrid(gl, board, wallId, sectorId, U.HitType.UPPER_WALL);
  drawGrid(gl, board, wallId, sectorId, U.HitType.MID_WALL);
  drawGrid(gl, board, wallId, sectorId, U.HitType.LOWER_WALL);
  drawEdges(gl, board, wallId, sectorId, U.HitType.UPPER_WALL);
  drawEdges(gl, board, wallId, sectorId, U.HitType.MID_WALL);
  drawEdges(gl, board, wallId, sectorId, U.HitType.LOWER_WALL);
}

function highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number) {
  drawEdges(gl, board, spriteId, -1, U.HitType.SPRITE);
}

function highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: U.HitType) {
  drawGrid(gl, board, id, addId, type);
  drawEdges(gl, board, id, addId, type);
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
    GLM.vec4.set(tmp, -wall1.x, 0, -wall1.y, 0);
    GLM.mat4.translate(texMat, texMat, tmp);
  }
  return texMat;
}

function drawGrid(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: U.HitType) {
  let r = <Solid>cache.getByIdType(id, addId, type);
  BGL.draw(gl, wrapInGrid(r, gridMatrix(board, id, type)));
}

function drawEdges(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: U.HitType) {
  BGL.draw(gl, cache.getByIdType(id, addId, type, true));
  if (U.isSector(type)) {
    let sec = board.sectors[id];
    let start = sec.wallptr;
    let end = sec.wallptr + sec.wallnum;
    for (let w = start; w < end; w++) {
      BGL.draw(gl, cache.getWallPoint(w, 32, type == U.HitType.CEILING));
    }
  } else if (U.isWall(type)) {
    let wall = board.walls[id];
    BGL.draw(gl, cache.getWallPoint(id, 32, false));
    BGL.draw(gl, cache.getWallPoint(id, 32, true));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, false));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, true));
  }
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

function drawStack(gl: WebGLRenderingContext, board: Board, ctr: Controller3D, link: BLOOD.RorLink, surface: Renderable, stencilValue: number) {
  if (!link)
    return;

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeStencilOnly(gl, stencilValue);
  BGL.draw(gl, surface);

  let src = board.sprites[link.srcSpriteId];
  let dst = board.sprites[link.dstSpriteId];
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

let rorSectorCollector = VIS.createSectorCollector((board: Board, sectorId: number) => rorLinks.hasRor(sectorId));
function drawRor(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forSector(rorSectorCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    let s = rorSectorCollector.sectors.get(i);
    let r = cache.getSector(s);
    drawStack(gl, board, ctr, rorLinks.ceilLinks[s], r.ceiling, i + 1);
    drawStack(gl, board, ctr, rorLinks.floorLinks[s], r.floor, i + 1);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

let mirrorWallsCollector = VIS.createWallCollector((board: Board, wallId: number, sectorId: number) => board.walls[wallId].picnum == BLOOD.MIRROR_PIC);
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
    let r = cache.getWall(w, VIS.unpackSectorId(mirrorWallsCollector.walls.get(i)));
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

function drawArray(gl: WebGLRenderingContext, arr: ObjectVector<Renderable>) {
  for (let i = 0; i < arr.length(); i++) {
    BGL.draw(gl, arr.get(i));
  }
}

let surfaces = new ObjectVector<Renderable>();
let surfacesTrans = new ObjectVector<Renderable>();
let sprites = new ObjectVector<Renderable>();
let spritesTrans = new ObjectVector<Renderable>();
function drawRooms(gl: WebGLRenderingContext, board: Board, result: VIS.Result) {
  PROFILE.startProfile('processing');
  surfaces.clear();
  surfacesTrans.clear();
  sprites.clear();
  spritesTrans.clear();

  result.forSector((board: Board, sectorId: number) => {
    let sector = cache.getSector(sectorId);
    if (rorLinks.floorLinks[sectorId] == undefined)
      surfaces.push(sector.floor);
    if (rorLinks.ceilLinks[sectorId] == undefined)
      surfaces.push(sector.ceiling);
    PROFILE.incCount('sectors');
  });
  result.forWall((board: Board, wallId: number, sectorId: number) => {
    if (board.walls[wallId].picnum == BLOOD.MIRROR_PIC)
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