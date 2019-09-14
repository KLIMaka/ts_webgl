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

  public think(speed: number): void {

    speed *= 8000;
    // Forward movement
    var up = INPUT.keys['W'] ? 1 : 0;
    var down = INPUT.keys['S'] ? 1 : 0;
    var forward = this.camera.forward();
    GLM.vec3.scale(forward, forward, speed * (up - down));
    var campos = this.camera.getPosition();
    GLM.vec3.add(campos, campos, forward);

    // Sideways movement
    var left = INPUT.keys['A'] ? 1 : 0;
    var right = INPUT.keys['D'] ? 1 : 0;
    var sideways = this.camera.side();
    GLM.vec3.scale(sideways, sideways, speed * (right - left));
    GLM.vec3.add(campos, campos, sideways);
    this.camera.setPosition(campos);

    if (INPUT.mouseButtons[2]) {
      this.camera.updateAngles((INPUT.mouseX - this.oldX) / 2, (INPUT.mouseY - this.oldY) / 2);
    }
    this.oldX = INPUT.mouseX;
    this.oldY = INPUT.mouseY;
  }
}