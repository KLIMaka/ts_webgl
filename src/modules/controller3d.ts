import camera = require('./camera');
import GLM = require('../libs_js/glmatrix');
import MU = require('../libs/mathutils');

function mapKeyCode(code) {
  var named = {
    8: 'BACKSPACE',
    9: 'TAB',
    13: 'ENTER',
    16: 'SHIFT',
    27: 'ESCAPE',
    32: 'SPACE',
    37: 'LEFT',
    38: 'UP',
    39: 'RIGHT',
    40: 'DOWN'
  };
  return named[code] || (code >= 65 && code <= 90 ? String.fromCharCode(code) : null);
}

export class Controller3D {

  private gl:WebGLRenderingContext;
  private camera = new camera.Camera(0, 0, 0, 0, 0);
  private projection = GLM.mat4.create();
  private drag = false;
  private oldX = 0;
  private oldY = 0;
  private keys = {};
  private fov = 90;
  private click = false;

  constructor(gl:WebGLRenderingContext) {
    this.gl = gl;
    var self = this;
    this.gl.canvas.addEventListener('mousemove', (e:MouseEvent) => self.mousemove(e));
    this.gl.canvas.addEventListener('mouseup', (e:MouseEvent) => self.mouseup(e));
    this.gl.canvas.addEventListener('mousedown', (e:MouseEvent) => self.mousedown(e));
    this.gl.canvas.addEventListener('mousewheel', (e:MouseWheelEvent) => self.mousewheel(e));

    document.addEventListener('keyup', (e:KeyboardEvent) => self.keyup(e));
    document.addEventListener('keydown', (e:KeyboardEvent) => self.keydown(e));
  }

  private mousemove(e:MouseEvent):boolean {
    if (this.drag) {
      this.camera.updateAngles(e.x - this.oldX, e.y - this.oldY);
    }
    this.oldX = e.x;
    this.oldY = e.y;
    return false;
  }

  private mouseup(e:MouseEvent):boolean {
    this.drag = false;
    this.click = true;
    return false;
  }

  private mousedown(e:MouseEvent):boolean {
    this.drag = true;
    return false;
  }

  private mousewheel(e:MouseWheelEvent):boolean {
    this.fov += -e.wheelDelta / 60;
    return false;
  }

  private keydown(e:KeyboardEvent) {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      var key = mapKeyCode(e.keyCode);
      if (key) this.keys[key] = true;
      this.keys[e.keyCode] = true;
    }
    return false;
  }

  private keyup(e:KeyboardEvent) {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      var key = mapKeyCode(e.keyCode);
      if (key) this.keys[key] = false;
      this.keys[e.keyCode] = false;
    }
    return false;
  }

  public getX():number {
    return this.oldX;
  }

  public getY():number {
    return this.oldY;
  }

  public getMatrix():GLM.Mat4Array {
    var projection = this.projection;
    GLM.mat4.perspective(projection, MU.deg2rad(this.fov), this.gl.drawingBufferWidth / this.gl.drawingBufferHeight, 1, 0xFFFF);
    GLM.mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public getProjectionMatrix():GLM.Mat4Array {
    return GLM.mat4.perspective(this.projection, MU.deg2rad(this.fov), this.gl.drawingBufferWidth / this.gl.drawingBufferHeight, 1, 0xFFFF);
  }

  public getModelViewMatrix():GLM.Mat4Array {
    return this.camera.getTransformMatrix();
  }

  public getCamera():camera.Camera {
    return this.camera;
  }

  public isClick():boolean {
    return this.click;
  }

  public move(speed:number):void {

    speed *= 8000;
    // Forward movement
    var up = this.keys['W'] | this.keys['UP'];
    var down = this.keys['S'] | this.keys['DOWN'];
    var forward = this.camera.forward();
    GLM.vec3.scale(forward, forward, speed * (up - down));
    var campos = this.camera.getPos();
    GLM.vec3.add(campos, campos, forward);

    // Sideways movement
    var left = this.keys['A'] | this.keys['LEFT'];
    var right = this.keys['D'] | this.keys['RIGHT'];
    var sideways = this.camera.side();
    GLM.vec3.scale(sideways, sideways, speed * (right - left));
    GLM.vec3.add(campos, campos, sideways);

    this.click = false;
    this.camera.setPos(campos);    
  }
}