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
  private camera = new camera.Camera(0, 0, 2, 0, 0);
  private projection = GLM.mat4.create();
  private drag = false;
  private oldX = 0;
  private oldY = 0;
  private keys = {};
  private fow = 45;

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
      this.camera.updateAngles(e.x - this.oldX, e.y - this.oldY);
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

  private mousewheel(e:MouseWheelEvent):boolean {
    this.fow += e.wheelDelta / 120;
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
    GLM.mat4.perspective(projection, MU.deg2rad(this.fow), this.gl.drawingBufferWidth / this.gl.drawingBufferHeight, 0.01, 0xFFFF);
    GLM.mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public getCamera():camera.Camera {
    return this.camera;
  }

  public move(speed:number):void {

    speed *= 8000;
    // Forward movement
    var up = this.keys['W'] | this.keys['UP'];
    var down = this.keys['S'] | this.keys['DOWN'];
    var forward = this.camera.forward();
    GLM.vec3.scale(forward, forward, speed * (up - down));
    var campos = this.camera.getPos();
    var startY = campos[1];
    GLM.vec3.add(campos, campos, forward);

    // Sideways movement
    var left = this.keys['A'] | this.keys['LEFT'];
    var right = this.keys['D'] | this.keys['RIGHT'];
    var sideways = this.camera.side();
    GLM.vec3.scale(sideways, sideways, speed * (right - left));
    GLM.vec3.add(campos, campos, sideways);

    var u = this.keys['F'] | 0;
    var d = this.keys['V'] | 0;
    campos[1] = startY + (speed * (u-d));
    

    this.camera.setPos(campos);

    // this.camera.move(GLM.vec3.fromValues(speed * (right - left), 0, speed * (down - up)));
    
  }
}