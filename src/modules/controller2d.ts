import camera = require('./camera');
import GLM = require('../libs_js/glmatrix');

export class Controller2D {

  private gl:WebGLRenderingContext;
  private camera = new camera.Camera(0, 0, 0, 0, 0);
  private drag = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraX = 0;
  private cameraY = 0;
  private scale = 1;
  private projection = GLM.mat4.create();
  private dragButton = 1;

  constructor(gl:WebGLRenderingContext) {
    this.gl = gl;
    var self = this;
    this.gl.canvas.addEventListener('mousemove', (e:MouseEvent) => self.mousemove(e));
    this.gl.canvas.addEventListener('mouseup', (e:MouseEvent) => self.mouseup(e));
    this.gl.canvas.addEventListener('mousedown', (e:MouseEvent) => self.mousedown(e));
    this.gl.canvas.addEventListener('mousewheel', (e:MouseWheelEvent) => self.mousewheel(e));
  }

  private mousemove(e:MouseEvent):boolean {
    if (this.drag) {
      var dx = (e.x - this.dragStartX) * this.scale;
      var dy = (e.y - this.dragStartY) * this.scale;
      this.camera.setPosXYZ(this.cameraX - dx, this.cameraY - dy, 0);
    }
    return false;
  }

  private mouseup(e:MouseEvent):boolean {
    if (e.button != this.dragButton)
      return;
    this.drag = false;
    return false;
  }

  private mousedown(e:MouseEvent):boolean {
    if (e.button != this.dragButton)
      return;
    this.drag = true;
    this.dragStartX = e.x;
    this.dragStartY = e.y;
    var campos = this.camera.getPos();
    this.cameraX = campos[0];
    this.cameraY = campos[1];
    return false;
  }

  private mousewheel(e:MouseWheelEvent):boolean {
    var dx = e.x - this.gl.drawingBufferWidth/2;
    var dy = e.y - this.gl.drawingBufferHeight/2;

    var k = -e.wheelDelta * 1/1200;
    this.scale *= k + 1;

    var campos = this.camera.getPos();
    var koef = this.scale * -(k/(k+1));
    var newX = campos[0] + dx * koef;
    var newY = campos[1] + dy * koef;
    this.camera.setPosXYZ(newX, newY, 0);
    return false;
  }

  public setUnitsPerPixel(scale:number) {
    this.scale = scale;
  }

  public setPos(x:number, y:number):void {
    this.camera.setPosXYZ(x, y, 0);
  }

  public getMatrix():GLM.Mat4Array {
    var projection = this.projection;
    var wscale = this.gl.drawingBufferWidth/2 * this.scale;
    var hscale = this.gl.drawingBufferHeight/2 * this.scale;
    GLM.mat4.ortho(projection, -wscale, wscale, hscale, -hscale, -0xFFFF, 0xFFFF);
    GLM.mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public unproject(x:number, y:number):number[] {
    var campos = this.camera.getPos();
    var dx = this.gl.drawingBufferWidth/2;
    var dy = this.gl.drawingBufferHeight/2;
    return [(x-dx)*this.scale + campos[0], (y-dy)*this.scale + campos[1]];
  }

  public setDragButton(btn:number) {
    this.dragButton = btn;
  }
}

export function create(gl:WebGLRenderingContext):Controller2D {
  return new Controller2D(gl);
}