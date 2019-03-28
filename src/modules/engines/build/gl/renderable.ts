import * as BUFF from './buffers';
import * as DS from '../../../drawstruct';
import * as GLM from '../../../../libs_js/glmatrix';


export class Buffer {
  private ptr:BUFF.BufferPointer;

  public get():BUFF.BufferPointer {
    return this.ptr;
  }

  public allocate(vtxCount:number, triIndexCount:number, lineIndexCount:number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size <= vtxCount && this.ptr.triIdx.size <= triIndexCount && this.ptr.lineIdx.size <= lineIndexCount)
        return;
      BUFF.remove(this.ptr);
    }
    this.ptr = BUFF.allocate(vtxCount, triIndexCount, lineIndexCount);
  }

  public deallocate() {
    if (this.ptr != null)
      BUFF.remove(this.ptr);
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

  public writeLine(off:number, a:number, b:number):number {
    return BUFF.writeLine(this.ptr, off, a, b);
  }
}

export enum Type {
  SURFACE,
  FACE
}

export class Renderable {
  public type:Type = Type.SURFACE;
  public buff:Buffer = new Buffer();
  public tex:DS.Texture;
  public shade:number;
  public trans:number = 1;
  public pal:number;
  public texMat:GLM.Mat4Array = GLM.mat4.create();
}
