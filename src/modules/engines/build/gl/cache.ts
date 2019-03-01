import * as BAG from '../../../../libs/bag';
import * as BUFF from './buffers';

export class CacheEntry {
  private ptr:BUFF.BufferPointer;
  private valid:boolean;

  public setValid(v:boolean) {
    this.valid = v;
  }

  public isValid():boolean {
    return this.valid;
  }

  public get():BUFF.BufferPointer {
    return this.ptr;
  }

  public allocate(vtxCount:number, triIndexCount:number, lineIndexCount:number) {
    this.valid = false;
    if (this.ptr != null) {
      if (this.ptr.vtx.size <= vtxCount && this.ptr.triIdx.size <= triIndexCount && this.ptr.lineIdx.size <= lineIndexCount)
        return;
      BUFF.remove(this.ptr);
    }
    this.ptr = BUFF.allocate(vtxCount, triIndexCount, lineIndexCount);
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