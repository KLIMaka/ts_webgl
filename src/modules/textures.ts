import DS = require('drawstruct');
import MU = require('../libs/mathutils')

export class Texture implements DS.Texture {

  public id:WebGLTexture;
  private width:number;
  private height:number;
  private format:number;
  private type:number;
  public data:ArrayBufferView;

  constructor(width:number, height:number, gl:WebGLRenderingContext, img:ArrayBufferView = null) {
    this.id = gl.createTexture();
    this.width = width;
    this.height = height;
    this.format = gl.RGBA;
    this.type = gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, /*gl.NEAREST*/gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, /*gl.NEAREST*/gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    if (img == null) 
      img = new Uint8Array(width*height*4);
    this.data = img;
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, this.data);
  }

  public get():WebGLTexture {
    return this.id;
  }

  public getWidth():number {
    return this.width;
  }

  public getHeight():number {
    return this.height;
  }

  public getFormat():number {
    return this.format;
  }

  public getType():number {
    return this.type;
  }
}

export class DrawTexture extends Texture {

  constructor(width:number, height:number, gl:WebGLRenderingContext, img:ArrayBufferView = null) {
    super(width, height, gl, img);
  }

  public putPiexl(x:number, y:number, pixel:ArrayBufferView, gl:WebGLRenderingContext) {
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, this.getFormat(), this.getType(), pixel);
  }
}

export class RenderTexture extends Texture {

  private framebuffer:WebGLFramebuffer;
  private renderbuffer:WebGLRenderbuffer;

  constructor(width:number, height:number, gl:WebGLRenderingContext, img:ArrayBufferView = null) {
    super(width, height, gl, img);
    this.framebuffer = gl.createFramebuffer();
    this.renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.getWidth(), this.getHeight());
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  public drawTo(gl:WebGLRenderingContext, callback:(WebGLRenderingContext)=>void):ArrayBufferView {
    var v = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderbuffer);
    gl.viewport(0, 0, this.getWidth(), this.getHeight());

    callback(gl);

    gl.readPixels(0, 0, this.getWidth(), this.getHeight(), gl.RGBA, gl.UNSIGNED_BYTE, this.data);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.viewport(v[0], v[1], v[2], v[3]);

    return this.data;
  }
}