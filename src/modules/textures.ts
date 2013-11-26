/// <reference path="../defs/webgl.d.ts"/>

var framebuffer:WebGLFramebuffer;
var renderbuffer:WebGLRenderbuffer;

export class Texture {

  public id:WebGLTexture;
  private width:number;
  private height:number;
  private format:number;
  private type:number;

  constructor(width:number, height:number, img:ArrayBufferView, gl:WebGLRenderingContext) {
    this.id = gl.createTexture();
    this.width = width;
    this.height = height;
    this.format = gl.RGBA;
    this.type = gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, /*gl.NEAREST*/gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, /*gl.NEAREST*/gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, img);
  }

  public bind(gl:WebGLRenderingContext):void {
    gl.bindTexture(gl.TEXTURE_2D, this.id);
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

  constructor(width:number, height:number, img:ArrayBufferView, gl:WebGLRenderingContext) {
    super(width, height, img, gl);
  }

  public putPiexl(x:number, y:number, pixel:Uint8Array, gl:WebGLRenderingContext) {
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, this.getFormat(), this.getType(), pixel);
  }
}

export class RenderTexture extends Texture {

  private data:ArrayBufferView;

  constructor(width:number, height:number, img:ArrayBufferView, gl:WebGLRenderingContext) {
    super(width, height, img, gl);
    this.data = img;
  }

  public drawTo(gl:WebGLRenderingContext, callback:(WebGLRenderingContext)=>void):ArrayBufferView {
    var v = gl.getParameter(gl.VIEWPORT);
    framebuffer = framebuffer || gl.createFramebuffer();
    renderbuffer = renderbuffer || gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.getWidth(), this.getHeight());
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
    gl.viewport(0, 0, this.getWidth(), this.getHeight());

    callback(gl);

    gl.readPixels(0, 0, this.getWidth(), this.getHeight(), gl.RGBA, gl.UNSIGNED_BYTE, this.data);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.viewport(v[0], v[1], v[2], v[3]);

    return this.data;
  }
}