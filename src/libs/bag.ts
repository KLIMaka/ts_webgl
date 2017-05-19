import L = require('./list');

class Place {
  constructor(public offset:number, public size:number) {}
}

export class Bag {
  private holes:L.List<Place> = new L.List<Place>();

  constructor(private size:number) {
    this.holes.insertAfter(new Place(0, size));
  }

  private getSuitablePlace(size:number): L.Node<Place> {
    for (var hole = this.holes.first(); hole != this.holes.terminator(); hole = hole.next) {
      if (hole.obj.size >= size)
        return hole;
    }
    return null;
  }

  private tryMerge(node:L.Node<Place>): void {
    if (node != this.holes.terminator() && node.next != this.holes.terminator()) {
      if (node.obj.offset + node.obj.size == node.next.obj.offset) {
        node.obj.size += node.next.obj.size;
        this.holes.remove(node.next);
        this.tryMerge(node);
      }
    }
  }

  public put(offset:number, size:number):void {
    var hole = this.holes.first();
    while (hole.next != this.holes.terminator()) {
      var next = hole.next;
      if (next.obj.offset >= size)
        break;
      hole = next;
    }
    if (hole == this.holes.terminator()) {
      this.holes.insertAfter(new Place(offset, size));
      return;
    }
    var end = hole.obj.offset + hole.obj.size;
    if (end > offset)
      throw new Error('object does not fit in hole');
    if (end == offset) {
      hole.obj.size += size;
      this.tryMerge(hole);
    } else if (hole.next != this.holes.terminator() && offset + size == hole.next.obj.offset) {
      hole.next.obj.offset -= size;
      hole.next.obj.size += size;
    } else {
      this.holes.insertAfter(new Place(offset, size), hole);
    }
  }

  public get(size:number):number {
    var hole = this.getSuitablePlace(size);
    if (hole.obj.size == size) {
      var prev = hole.prev;
      this.holes.remove(hole);
      this.tryMerge(prev);
      return hole.obj.offset;
    } else {
      var off = hole.obj.offset;
      hole.obj.offset += size;
      hole.obj.size -= size;
      return off;
    }
  }
}

export function create(size:number):Bag {
  return new Bag(size);
}