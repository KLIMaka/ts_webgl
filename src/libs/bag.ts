import * as L  from './list';

export class Place {
  constructor(public offset:number, public size:number, public data:any=null) {}
}

export class Bag {
  private holes:L.List<Place>;

  constructor(private size:number) {
    this.reset();
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
    if (hole == this.holes.terminator()) {
      this.holes.insertAfter(new Place(offset, size));
      return;
    }
    while (hole.next != this.holes.terminator()) {
      var next = hole.next;
      if (next.obj.offset >= size+offset)
        break;
      hole = next;
    }
    var end = hole.obj.offset + hole.obj.size;
    if (end > offset)
      throw new Error('Object does not fit in hole');
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
    if (hole == null)
      return null;
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

  public reset() {
    this.holes = new L.List<Place>();
    this.holes.insertAfter(new Place(0, this.size));
  }
}

export class BagController {
  private bag:Bag;
  private places = {};
  private updater:(place:Place, noffset:number)=>void;

  constructor(size:number, updater:(place:Place, noffset:number)=>void) {
    this.bag = new Bag(size);
    this.updater = updater;
  }

  public get(size:number):Place {
    var offset = this.bag.get(size);
    if (offset == null) {
      this.optimize();
      offset = this.bag.get(size);
    }
    if (offset == null)
      throw new Error('No space');
    var result = new Place(offset, size);
    this.places[offset] = result;
    return result;
  }

  public put(place:Place):void {
    this.bag.put(place.offset, place.size);
    delete this.places[place.offset];
  }

  public optimize() {
    var places = this.places;
    var keys = Object.keys(places);
    this.places = {};
    this.bag.reset();
    var offset = 0;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var place = places[key];
      this.places[offset] = place;
      if (place.offset == offset)
        continue;
      this.updater(place, offset);
      place.offset = offset;
      offset += place.size;
    }
    this.bag.get(offset);
  }
}

export function create(size:number):Bag {
  return new Bag(size);
}

export function createController(size:number, updater:(place:Place, noffset:number)=>void):BagController {
  return new BagController(size, updater);
}