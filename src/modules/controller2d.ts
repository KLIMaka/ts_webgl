import camera = require('./camera');
import GLM = require('../libs_js/glmatrix');

let pointer = GLM.vec2.create();

export class Controller2D {
  private camera = new camera.Camera(0, 0, 0, 0, 0);
  private oldX = 0;
  private oldY = 0;
  private scale = 1;
  private projection = GLM.mat4.create();

  public track(x: number, y: number, move: boolean) {
    if (move) {
      var dx = (x - this.oldX) * this.scale;
      var dy = (y - this.oldY) * this.scale;
      let pos = this.camera.getPosition();
      this.camera.setPositionXYZ(pos[0] - dx, 0, pos[2] - dy);
    }
    this.oldX = x;
    this.oldY = y;
  }

  // private mousewheel(e: WheelEvent): boolean {
  //   var dx = e.clientX - this.gl.drawingBufferWidth / 2;
  //   var dy = e.clientY - this.gl.drawingBufferHeight / 2;

  //   var k = -MU.sign(e.deltaY) / 10;
  //   this.scale *= k + 1;

  //   var campos = this.camera.getPosition();
  //   var koef = this.scale * -(k / (k + 1));
  //   var newX = campos[0] + dx * koef;
  //   var newY = campos[1] + dy * koef;
  //   this.camera.setPositionXYZ(newX, newY, 0);
  //   return false;
  // }

  public setUnitsPerPixel(scale: number) {
    this.scale = scale;
  }

  public getUnitsPerPixel() {
    return this.scale;
  }

  public setPos(x: number, y: number): void {
    this.camera.setPositionXYZ(x, 16 * 1024, y);
  }

  public getForwardUnprojected(gl: WebGLRenderingContext, x: number, y: number): GLM.Vec3Array {
    return [0, -1, 0];
  }

  public getPointerPosition(gl: WebGLRenderingContext, x: number, y: number) {
    let hw = gl.drawingBufferWidth / 2;
    let hh = gl.drawingBufferHeight / 2;
    let pos = this.camera.getPosition();
    return GLM.vec2.set(pointer, pos[0] + (x - hw) * this.scale, pos[2] + (y - hh) * this.scale);
  }

  public getTransformMatrix() {
    return this.camera.getTransformMatrix();
  }

  public getProjectionMatrix(gl: WebGLRenderingContext) {
    var projection = this.projection;
    var wscale = gl.drawingBufferWidth / 2 * this.scale;
    var hscale = gl.drawingBufferHeight / 2 * this.scale;
    GLM.mat4.identity(projection);
    GLM.mat4.ortho(projection, -wscale, wscale, hscale, -hscale, -0xFFFF, 0xFFFF);
    GLM.mat4.rotateX(projection, projection, -Math.PI / 2);
    return projection;
  }

  public getPosition() {
    return this.camera.getPosition();
  }

  public getForward() {
    return [0, -1, 0];
  }

}
