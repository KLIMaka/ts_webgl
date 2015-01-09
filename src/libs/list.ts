
export class Node<T> {
  constructor(public obj:T=null, public next:Node<T>=null, public prev:Node<T>=null) {
  }
}

export class List<T> {

  private nil = new Node<T>();

  constructor() {
    this.nil.next = this.nil;
    this.nil.prev = this.nil;
  }

  public first():Node<T> {
    return this.nil.next;
  }

  public last():Node<T> {
    return this.nil.prev;
  }

  public pop():T {
    var ret = this.last().obj;
    this.remove(this.last());
    return ret;
  }

  public isEmpty():boolean {
    return this.nil.next == this.nil;
  }

  public insertNodeBefore(node:Node<T>, ref:Node<T> = this.nil.next):void {
    node.next = ref;
    node.prev = ref.prev;
    node.prev.next = node;
    ref.prev = node;
  }

  public insertBefore(val:T, ref:Node<T>=this.nil.next):void {
    this.insertNodeBefore(new Node<T>(val), ref);
  }

  public insertNodeAfter(node:Node<T>, ref:Node<T> = this.nil.prev):void {
    node.next = ref.next;
    node.next.prev = node;
    ref.next = node;
    node.prev = ref;
  }

  public insertAfter(val:T, ref:Node<T>=this.nil.prev):void {
    this.insertNodeAfter(new Node<T>(val), ref);
  }

  public remove(ref:Node<T>):Node<T> {
    if (ref == this.nil)
      return;

    ref.next.prev = ref.prev;
    ref.prev.next = ref.next;
    return ref;
  }
}

export function <T> create() {
  return new List<T>();
}