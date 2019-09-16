import * as MU from '../libs/mathutils';
import * as GLM from '../libs_js/glmatrix';
import * as camera from './camera';
import * as INPUT from './input';

export class Controller3D {
  private camera = new camera.Camera(0, 0, 0, 0, 0);
  private projection = GLM.mat4.create();
  private fov = 90;
  private oldX = 0;
  private oldY = 0;

  public setFov(fov: number) {
    this.fov = fov;
  }

  public getFov(): number {
    return this.fov;
  }

  public getMatrix(gl: WebGLRenderingContext): GLM.Mat4Array {
    var projection = this.projection;
    GLM.mat4.perspective(projection, MU.deg2rad(this.fov), gl.drawingBufferWidth / gl.drawingBufferHeight, 1, 0xFFFF);
    GLM.mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public getProjectionMatrix(gl: WebGLRenderingContext): GLM.Mat4Array {
    return GLM.mat4.perspective(this.projection, MU.deg2rad(this.fov), gl.drawingBufferWidth / gl.drawingBufferHeight, 1, 0xFFFF);
  }

  public getCamera(): camera.Camera {
    return this.camera;
  }

  public getForwardUnprojected(gl: WebGLRenderingContext, x: number, y: number): GLM.Vec3Array {
    var invertTrans = GLM.mat4.invert(GLM.mat4.create(), this.getCamera().getTransformMatrix());
    var invTP = GLM.mat4.invert(GLM.mat4.create(), this.getProjectionMatrix(gl));
    var invTP = GLM.mat4.mul(invTP, invertTrans, invTP);
    var dx = 2 * x / gl.drawingBufferWidth - 1;
    var dy = 2 * y / gl.drawingBufferHeight - 1;
    var forward = GLM.vec3.transformMat4(GLM.vec3.create(), [dx, -dy, -1], invTP);
    GLM.vec3.sub(forward, forward, this.getCamera().getPosition());
    return GLM.vec3.normalize(forward, forward);
  }

  public moveForward(dist: number) {
    var forward = this.camera.forward();
    var campos = this.camera.getPosition();
    GLM.vec3.scale(forward, forward, dist);
    GLM.vec3.add(campos, campos, forward);
    this.camera.setPosition(campos);
  }

  public moveSideway(dist: number) {
    var sideways = this.camera.side();
    var campos = this.camera.getPosition();
    GLM.vec3.scale(sideways, sideways, dist);
    GLM.vec3.add(campos, campos, sideways);
    this.camera.setPosition(campos);
  }

  public track(x: number, y: number, move: boolean) {
    if (move) this.camera.updateAngles((x - this.oldX) / 2, (y - this.oldY) / 2);
    this.oldX = x;
    this.oldY = y;
  }
}