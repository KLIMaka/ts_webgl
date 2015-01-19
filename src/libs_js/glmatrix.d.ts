
export interface Vec2Array extends Array<number> {
}

export interface Vec3Array extends Array<number> {
}

export interface Vec4Array extends Array<number> {
}

export interface Mat2Array extends Array<number> {
}

export interface Mat3Array extends Array<number> {
}

export interface Mat4Array extends Array<number> {
}

export declare module vec2 {
  export function add(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function create(): Vec2Array;
  export function clone(a:Vec2Array): Vec2Array;
  export function fromValues(x:number, y:number): Vec2Array;
  export function copy(out:Vec2Array, a:Vec2Array): Vec2Array;
  export function set(out:Vec2Array, x:number, y:number): Vec2Array;
  export function sub(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function subtract(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function mul(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function multiply(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function div(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function divide(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function min(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function max(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function scale(out:Vec2Array, a:Vec2Array, b:number): Vec2Array;
  export function dist(a:Vec2Array, b:Vec2Array): number;
  export function distance(a:Vec2Array, b:Vec2Array): number;
  export function sqrDist(a:Vec2Array, b:Vec2Array): number;
  export function squaredDistance(a:Vec2Array, b:Vec2Array): number;
  export function len(a:Vec2Array): number;
  export function length(a:Vec2Array): number;
  export function sqrLen(a:Vec2Array): number;
  export function squaredLength(a:Vec2Array): number;
  export function negate(out:Vec2Array, a:Vec2Array): Vec2Array;
  export function normalize(out:Vec2Array, a:Vec2Array): Vec2Array;
  export function dot(a:Vec2Array, b:Vec2Array): number;
  export function cross(out:Vec2Array, a:Vec2Array, b:Vec2Array): Vec2Array;
  export function lerp(out:Vec2Array, a:Vec2Array, b:Vec2Array, t:number): Vec2Array;
  export function transformMat2(out:Vec2Array, a:Vec2Array, m:Mat2Array): Vec2Array;
  export function str(a:Vec2Array): string;
}

export declare module vec3 {
  export function add(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function create(): Vec3Array;
  export function clone(a:Vec3Array): Vec3Array;
  export function fromValues(x:number, y:number, z:number): Vec3Array;
  export function copy(out:Vec3Array, a:Vec3Array): Vec3Array;
  export function set(out:Vec3Array, x:number, y:number, z:number): Vec3Array;
  export function sub(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function subtract(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function mul(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function multiply(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function div(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function divide(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function min(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function max(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function scale(out:Vec3Array, a:Vec3Array, b:number): Vec3Array;
  export function dist(a:Vec3Array, b:Vec3Array): number;
  export function distance(a:Vec3Array, b:Vec3Array): number;
  export function sqrDist(a:Vec3Array, b:Vec3Array): number;
  export function squaredDistance(a:Vec3Array, b:Vec3Array): number;
  export function len(a:Vec3Array): number;
  export function length(a:Vec3Array): number;
  export function sqrLen(a:Vec3Array): number;
  export function squaredLength(a:Vec3Array): number;
  export function negate(out:Vec3Array, a:Vec3Array): Vec3Array;
  export function normalize(out:Vec3Array, a:Vec3Array): Vec3Array;
  export function dot(a:Vec3Array, b:Vec3Array): number;
  export function cross(out:Vec3Array, a:Vec3Array, b:Vec3Array): Vec3Array;
  export function lerp(out:Vec3Array, a:Vec3Array, b:Vec3Array, t:number): Vec3Array;
  export function transformMat3(out:Vec3Array, a:Vec3Array, m:Mat3Array): Vec3Array;
  export function transformMat4(out:Vec3Array, a:Vec3Array, m:Mat4Array): Vec3Array;
  export function transformQuat(out:Vec3Array, a:Vec3Array, q:Vec4Array): Vec3Array;
  export function str(a:Vec3Array): string;
}

export declare module mat4 {
  export function create(): Mat4Array;
  export function clone(a:Mat4Array): Mat4Array;
  export function copy(out:Mat4Array, a:Mat4Array): Mat4Array;
  export function identity(out:Mat4Array): Mat4Array;
  export function transpose(out:Mat4Array, a:Mat4Array): Mat4Array;
  export function invert(out:Mat4Array, a:Mat4Array): Mat4Array;
  export function adjoint(out:Mat4Array, a:Mat4Array): Mat4Array;
  export function determinant(a:Mat4Array): number;
  export function mul(out:Mat4Array, a:Mat4Array, b:Mat4Array): Mat4Array;
  export function multiply(out:Mat4Array, a:Mat4Array, b:Mat4Array): Mat4Array;
  export function str(a:Mat4Array): string;
  export function translate(out:Mat4Array, a:Mat4Array, v:Vec3Array): Mat4Array;
  export function scale(out:Mat4Array, a:Mat4Array, v:Vec3Array): Mat4Array;
  export function rotate(out:Mat4Array, a:Mat4Array, rad:number, axis:Vec3Array): Mat4Array;
  export function rotateX(out:Mat4Array, a:Mat4Array, rad:number): Mat4Array;
  export function rotateY(out:Mat4Array, a:Mat4Array, rad:number): Mat4Array;
  export function rotateZ(out:Mat4Array, a:Mat4Array, rad:number): Mat4Array;
  export function fromRotationTranslation(out:Mat4Array, q:Vec4Array, v:Vec3Array): Mat4Array;
  export function frustum(out:Mat4Array, left:number, right:number, bottom:number, top:number, near:number, far:number): Mat4Array;
  export function perspective(out:Mat4Array, fovy:number, aspect:number, near:number, far:number): Mat4Array;
  export function ortho(out:Mat4Array, left:number, right:number, bottom:number, top:number, near:number, far:number): Mat4Array;
  export function lookAt(out:Mat4Array, eye:Vec3Array, center:Vec3Array, up:Vec3Array): Mat4Array;
}