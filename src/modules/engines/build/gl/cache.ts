import * as BAG from '../../../../libs/bag';
import * as BUFF from './buffers';

export class CacheEntry {
  private ptr:BUFF.BufferPointer;
  private invalid:boolean;

  private reallocate(vtxCount:number, triIndexCount:number, lineIndexCount:number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size <= vtxCount && this.ptr.triIdx.size <= triIndexCount && this.ptr.lineIdx.size <= lineIndexCount)
        return;
      BUFF.remove(this.ptr);
    }
    this.ptr = BUFF.allocate(vtxCount, triIndexCount, lineIndexCount);
  }
}