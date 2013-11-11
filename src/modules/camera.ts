import GLM = require('./../libs_js/glmatrix');
import MU = require('./../libs/mathutils');

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

  setPos(pos:GLM.Vec3Array):void {
    this.pos = pos;
    this.needUpdate = true;
  }

  setPosXYZ(x:number, y:number, z:number):void {
    GLM.vec3.set(this.pos, x, y, z);
    this.needUpdate = true;
  }

  getPos():GLM.Mat4Array {
    return this.pos;
  }

  move(delta:GLM.Vec3Array):void {
    var tmp = GLM.vec3.transformMat3(GLM.vec3.create(), delta, MU.mat3FromMat4(GLM.mat3.create(), this.getTransformMatrix()));
    GLM.vec3.add(this.pos, this.pos, tmp);
    this.needUpdate = true;
  }

  updateAngles(dx:number, dy:number):void {
    this.angleY -= dx;
    this.angleX -= dy;
    this.angleX = Math.max(-90, Math.min(90, this.angleX));
    this.needUpdate = true;
  }

  setAngles(ax:number, ay:number):void {
    this.angleX = ax;
    this.angleY = ay;
    this.needUpdate = true;
  }

  getTransformMatrix():GLM.Mat4Array {

    var mat = this.transform;
    if (this.needUpdate) {
      GLM.mat4.identity(mat);
      GLM.mat4.rotateX(mat, mat, MU.deg2rad(-this.angleX));
      GLM.mat4.rotateY(mat, mat, MU.deg2rad(-this.angleY));
      var pos = this.pos;
      GLM.vec3.negate(pos, pos);
      GLM.mat4.translate(mat, mat, pos);
      GLM.vec3.negate(pos, pos);
      this.needUpdate = false;
    }
    return mat;
  }

}