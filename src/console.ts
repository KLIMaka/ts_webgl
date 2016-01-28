import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import DS = require('./modules/drawstruct');
import MAT = require('./modules/materials');
import MU = require('./libs/mathutils');
import MB = require('./modules/meshbuilder');
import ctrl = require('./modules/controller2d');
import SHADERS = require('./modules/shaders');
import GLM = require('./libs_js/glmatrix');
import BATCHER = require('./modules/batcher');
import U2D = require('./modules/2dutils');

function loadImage(name: string, pal: Uint8Array, cb: (paletted: Uint8Array) => void) {
  var img = new Image();
  img.src = name;
  img.onload = function(evt) {
    var image = <HTMLImageElement> evt.target;
    var canvas: HTMLCanvasElement = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    var data = ctx.getImageData(0, 0, image.width, image.height).data;
    var paletted = [];
    var palmap = {};
    for (var c = 0; c < pal.length; c += 3) {
      palmap[pal[c + 0] + ',' + pal[c + 1] + ',' + pal[c + 2]] = c / 3;
    }
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        var r = data[y * image.width * 4 + x * 4 + 0];
        var g = data[y * image.width * 4 + x * 4 + 1];
        var b = data[y * image.width * 4 + x * 4 + 2];
        var color = palmap[r + ',' + g + ',' + b];
        if (color == undefined)
          paletted.push(0);
        else
          paletted.push(color);
      }
    }
    cb(new Uint8Array(paletted));
  }
}

class PlaneInternal {

  private pos:Float32Array;
  private tc:Float32Array;
  private aPos:MB.VertexBufferDynamic;
  private aTc:MB.VertexBufferDynamic;
  private vertexBuffers:{};
  private indexBuffer:DS.IndexBuffer;

  public init(gl:WebGLRenderingContext, numtiles:number):void {
    this.pos = new Float32Array(numtiles*2*4);
    this.tc = new Float32Array(numtiles*2*4);
    this.aPos = MB.wrap(gl, this.pos, 2, gl.STATIC_DRAW);
    this.aTc = MB.wrap(gl, this.tc, 2, gl.DYNAMIC_DRAW);
    this.vertexBuffers = {
      'aPos': this.aPos,
      'aTc': this.aTc
    }
    this.indexBuffer = MB.genIndexBuffer(gl, numtiles, [0, 2, 1, 0, 3, 2]);
  }

  public fill(gl:WebGLRenderingContext, cellWidth:number, cellHeight:number, width:number, height:number, data:number[]) {
    var pos = this.pos;
    var tc = this.tc;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var off = y*width*4*2+x*4*2;
        var xoff = x*cellWidth;
        var yoff = y*cellHeight;

        pos[off+0] = xoff; pos[off+1] = yoff;
        pos[off+2] = xoff; pos[off+3] = yoff+cellHeight;
        pos[off+4] = xoff+cellWidth; pos[off+5] = yoff+cellHeight;
        pos[off+6] = xoff+cellWidth; pos[off+7] = yoff;
      }
    }
    this.aPos.update(gl);
    this.aTc.update(gl);
  }
}

class AtlasInternal {
  private texture:DS.Texture;

  constructor(gl:WebGLRenderingContext, private atlas:Atlas) {
    this.texture = TEX.createTexture(atlas.width*atlas.cellWidth, atlas.cellHeight*atlas.height, gl, atlas.data, gl.LUMINANCE, 1);
  }

  public getRect(id:number):U2D.Rect {
    return U2D.gridCellId(id, this.atlas.cellWidth, this.atlas.cellHeight, this.atlas.width, this.atlas.height);
  }


}

class Atlas {
  public cellWidth: number;
  public cellHeight: number;
  public width: number;
  public height: number;
  public data: Uint8Array;
}

class Plane {
  public atlas: number;
  public width: number;
  public height: number;
}

class ROM {
  public width: number;
  public height: number;
  public palette: number[];
  public atlases: Atlas[];
  public planes: Plane[];
};

function createPal():Uint8Array {
  var pal = new Uint8Array(256 * 3);
  for (var i = 0; i < 256; i++) {
    var idx = i * 3;
    pal[idx + 0] = MU.int(Math.random() * 256);
    pal[idx + 1] = MU.int(Math.random() * 256);
    pal[idx + 2] = MU.int(Math.random() * 256);
  }
  pal[0] = 0; pal[1] = 0; pal[2] = 0;
  pal[3] = 255; pal[4] = 255; pal[5] = 255;
  return pal;
}

var pal = createPal();
loadImage('resources/img/font.png', pal, (paletted:Uint8Array) => render(paletted));

function render(img:Uint8Array) {
  var gl = GL.createContext(800, 600);
  var control = ctrl.create(gl);
  control.setUnitsPerPixel(0.5);
  control.setPos(128 / 2, 128 / 2);
  var tex = TEX.createDrawTexture(128, 128, gl, img, gl.LUMINANCE, 1);
  var palTex = TEX.createTexture(256, 1, gl, pal, gl.RGB, 3);
  
  var pos = new Float32Array(1 * 2 * 4);
  var tc = new Float32Array(1 * 2 * 4);
  var aPos = MB.genVertexBuffer(gl, gl.FLOAT, 2, false, pos, gl.DYNAMIC_DRAW);
  var aTc = MB.genVertexBuffer(gl, gl.FLOAT, 2, false, tc, gl.DYNAMIC_DRAW);
  pos[0] = 0; pos[1] = 0; pos[2] = 0; pos[3] = 128; pos[4] = 128; pos[5] = 128; pos[6] = 128; pos[7] = 0;
  tc[0] = 0; tc[1] = 0; tc[2] = 0; tc[3] = 1; tc[4] = 1; tc[5] = 1; tc[6] = 1; tc[7] = 0;
  MB.updateVertexBuffer(gl, aPos, pos);
  MB.updateVertexBuffer(gl, aTc, tc);

  var vertexBufs = {
    'aPos': aPos,
    'aTc': aTc
  }
  var indexBuffer = MB.genIndexBuffer(gl, 1, [0, 2, 1, 0, 3, 2], 4);
  var shader = SHADERS.createShader(gl, 'resources/shaders/indexed');
  var MVP = control.getMatrix();
  var struct = [gl.TRIANGLES, 6, 0];

  var cmds = [
    BATCHER.shader, shader,
    BATCHER.vertexBuffers, vertexBufs,
    BATCHER.indexBuffer, indexBuffer,
    BATCHER.uniforms, ['MVP', BATCHER.setters.mat4, MVP],
    BATCHER.bindTexture, [0, 'base', tex.get()],
    BATCHER.bindTexture, [1, 'pal', palTex.get()],
    BATCHER.drawCall, struct
  ];

  GL.animate(gl, function(gl: WebGLRenderingContext, dt: number) {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    BATCHER.exec(cmds, gl);
  });
}

