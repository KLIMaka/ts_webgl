import * as GLM from './../libs_js/glmatrix';
import * as MU from './../libs/mathutils';

export class Camera {

  private transform:GLM.Mat4Array;
  private pos:GLM.Vec3Array;
  private angleX:number;
  private angleY:number;
  private needUpdate:boolean = true;

  constructor(x:number, y:number, z:number, ax:number, ay:number) {
    this.transform = GLM.mat4.create();
    this.pos = GLM.vec3.fromValues(x, y, z);
    this.angleX = ax;
    this.angleY = ay;
  }

  public setPos(pos:GLM.Vec3Array):void {
    this.pos = pos;
    this.needUpdate = true;
  }

  public setPosXYZ(x:number, y:number, z:number):void {
    GLM.vec3.set(this.pos, x, y, z);
    this.needUpdate = true;
  }

  public getPos():GLM.Vec3Array {
    return this.pos;
  }

  public forward():GLM.Vec3Array {
    var mat4 = this.getTransformMatrix()
    return GLM.vec3.fromValues(-mat4[2], -mat4[6], -mat4[10]);
  }

  public side():GLM.Vec3Array {
    var mat4 = this.getTransformMatrix()
    return GLM.vec3.fromValues(mat4[0], mat4[4], mat4[8]);
  }

  public updateAngles(dx:number, dy:number):void {
    this.angleY -= dx;
    this.angleX -= dy;
    this.angleX = Math.max(-90, Math.min(90, this.angleX));
    this.needUpdate = true;
  }

  public setAngles(ax:number, ay:number):void {
    this.angleX = Math.max(-90, Math.min(90, ax));
    this.angleY = ay;
    this.needUpdate = true;
  }

  public getTransformMatrix():GLM.Mat4Array {

    var mat = this.transform;
    var pos = this.pos;
    if (this.needUpdate) {
      GLM.mat4.identity(mat);
      GLM.mat4.rotateX(mat, mat, MU.deg2rad(-this.angleX));
      GLM.mat4.rotateY(mat, mat, MU.deg2rad(-this.angleY));
      GLM.vec3.negate(pos, pos);
      GLM.mat4.translate(mat, mat, pos);
      GLM.vec3.negate(pos, pos);
      this.needUpdate = false;
    }
    return mat;
  }

  public getMirroredTransformMatrix(mirrorNormal:GLM.Vec3Array, mirrorD:number):GLM.Mat4Array {
    var fwd = this.forward();
    var dot = GLM.vec3.dot(fwd, mirrorNormal);
    if (dot == 0)
      return null;

    var trans =   this.getTransformMatrix();
    var side =    this.reflect(GLM.vec3.fromValues(trans[0], trans[4], trans[8]), mirrorNormal);
    var up =      this.reflect(GLM.vec3.fromValues(trans[1], trans[5], trans[9]), mirrorNormal);
    var forward = this.reflect(GLM.vec3.fromValues(trans[2], trans[6], trans[10]), mirrorNormal);

    var position = GLM.vec3.clone(this.pos);
    var t = -(GLM.vec3.dot(position, mirrorNormal) + mirrorD) / dot;
    var reflect = this.reflect(fwd, mirrorNormal);
    GLM.vec3.negate(reflect, reflect);
    var mirroredPos = GLM.vec3.add(position, position, GLM.vec3.scale(fwd, fwd, t));
    GLM.vec3.add(mirroredPos, mirroredPos, GLM.vec3.scale(reflect, reflect, t));

    var mat = GLM.mat4.create();
    mat[0] = side[0]; mat[1] = up[0]; mat[2] = forward[0], mat[3] = 0;
    mat[4] = side[1]; mat[5] = up[1]; mat[6] = forward[1], mat[7] = 0;
    mat[8] = side[2]; mat[9] = up[2]; mat[10] = forward[2], mat[11] = 0;
    mat[12] = -mirroredPos[0]; mat[13] = -mirroredPos[1]; mat[14] = -mirroredPos[2], mat[15] = 1;
    return mat;
  }

  private reflect(id:GLM.Vec3Array, n:GLM.Vec3Array):GLM.Vec3Array {
    var dot = GLM.vec3.dot(n, id);
    var result = GLM.vec3.create();
    GLM.vec3.scale(result, n, dot * 2);
    GLM.vec3.sub(result, id, result);
    return result;
  }

}