/// <reference path="../defs/webgl.d.ts"/>

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

  constructor(gl:WebGLRenderingContext) {
    this.gl = gl;
    var self = this;
    this.gl.canvas.addEventListener('mousemove', (e:MouseEvent) => self.mousemove(e));
    this.gl.canvas.addEventListener('mouseup', (e:MouseEvent) => self.mouseup(e));
    this.gl.canvas.addEventListener('mousedown', (e:MouseEvent) => self.mousedown(e));
    this.gl.canvas.addEventListener('mousewheel', (e:MouseWheelEvent) => self.mousewheel(e));

    window.document.addEventListener('keyup', (e) => self.keyup(e));
    window.document.addEventListener('keydown', (e) => self.keydown(e));
  }

  private mousemove(e:MouseEvent):boolean {
    if (this.drag) {
      this.camera.updateAngles(e.x - this.oldX,/* e.y - this.oldY*/0);
    }
    this.oldX = e.x;
    this.oldY = e.y;
    return false;
  }

  private mouseup(e:MouseEvent):boolean {
    this.drag = false;
    return false;
  }

  private mousedown(e:MouseEvent):boolean {
    this.drag = true;
    return false;
  }

  private mousewheel(e:MouseEvent):boolean {
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

  public getMatrix():GLM.Mat4Array {
    var projection = this.projection;
    GLM.mat4.perspective(projection, MU.deg2rad(30), this.gl.drawingBufferWidth / this.gl.drawingBufferHeight, -0xFFFF, 0xFFFF);
    GLM.mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public forward():GLM.Vec3Array {
    var mat3 = MU.mat3FromMat4(GLM.mat3.create(), this.camera.getTransformMatrix())
    return GLM.vec3.transformMat3(GLM.vec3.create(), GLM.vec3.fromValues(0, 0, -1), mat3);
  }

  public right():GLM.Vec3Array {
    var mat3 = MU.mat3FromMat4(GLM.mat3.create(), this.camera.getTransformMatrix())
    return GLM.vec3.transformMat3(GLM.vec3.create(), GLM.vec3.fromValues(1, 0, 0), mat3);
  }

  public move(speed:number):void {

    if (this.keys['P']) {
      console.log(this.forward());
    }
    speed *= 80000;
    // Forward movement
    var up = this.keys['W'] | this.keys['UP'];
    var down = this.keys['S'] | this.keys['DOWN'];
    var forward = this.forward();
    GLM.vec3.scale(forward, forward, speed * (up - down));
    var campos = this.camera.getPos();
    GLM.vec3.add(campos, campos, forward);

    // Sideways movement
    var left = this.keys['A'] | this.keys['LEFT'];
    var right = this.keys['D'] | this.keys['RIGHT'];
    var sideways = this.right();
    GLM.vec3.negate(sideways, sideways);
    GLM.vec3.scale(sideways, sideways, speed * (right - left));
    GLM.vec3.add(campos, campos, sideways);
    this.camera.setPos(campos);
  }
}