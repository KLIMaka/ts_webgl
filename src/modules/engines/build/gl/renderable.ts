import * as BUFF from './buffers';
import {Pointer} from '../../../buffergl';
import * as DS from '../../../drawstruct';
import * as GLM from '../../../../libs_js/glmatrix';
import {State} from '../../../stategl';


export class Buffer {
  private ptr:Pointer;

  public get():Pointer {
    return this.ptr;
  }

  public allocate(vtxCount:number, triIndexCount:number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size >= vtxCount && this.ptr.idx.size >= triIndexCount)
        return;
      BUFF.remove(this.ptr);
    }
    this.ptr = BUFF.allocate(vtxCount, triIndexCount);
  }

  public deallocate() {
    if (this.ptr != null) {
      BUFF.remove(this.ptr);
      this.ptr = null;
    }
  }

  public writePos(off:number, x:number, y:number, z:number):number {
    return BUFF.writePos(this.ptr, off, x, y, z);
  }

  public writeNormal(off:number, x:number, y:number):number {
    return BUFF.writeNormal(this.ptr, off, x, y);
  }

  public writeTriangle(off:number, a:number, b:number, c:number):number {
    return BUFF.writeTriangle(this.ptr, off, a, b, c);
  }

  public writeQuad(off:number, a:number, b:number, c:number, d:number):number {
    return BUFF.writeQuad(this.ptr, off, a, b, c, d);
  }

  public writeLine(off:number, a:number, b:number) {
    return BUFF.writeLine(this.ptr, off, a, b);
  }
}

export enum Type {
  SURFACE,
  FACE
}

export interface Renderable {
  draw(gl:WebGLRenderingContext, state:State);
}

export class Solid implements Renderable {
  public type:Type = Type.SURFACE;
  public buff:Buffer = new Buffer();
  public tex:DS.Texture;
  public shade:number;
  public trans:number = 1;
  public pal:number;
  public texMat:GLM.Mat4Array = GLM.mat4.create();

  public draw(gl:WebGLRenderingContext, state:State) {
    if (this.buff.get() == null)
      return;
    state.setShader(this.type == Type.SURFACE ? 'baseShader' : 'spriteShader' );
    state.setTexture('base', this.tex);
    state.setUniform('color', [1, 1, 1, this.trans]);
    state.setUniform('pluN', this.pal);
    state.setUniform('shade', this.shade);
    state.setUniform('T', this.texMat);
    state.setDrawElements(this.buff.get());
    state.draw(gl);
  }
}

export class Wireframe implements Renderable {
  public type:Type = Type.SURFACE;
  public buff:Buffer = new Buffer();

  public draw(gl:WebGLRenderingContext, state:State) {
    if (this.buff.get() == null)
      return;
    state.setShader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader' );
    state.setUniform('color', [1, 1, 1, 1]);
    state.setDrawElements(this.buff.get());
    state.draw(gl, gl.LINES);
  }
}