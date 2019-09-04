import { Iterator, ForwardIterator, BackIterator, WriteIterator } from "../modules/iterator";

export class Node<T> {
  constructor(
    public obj: T = null,
    public next: Node<T> = null,
    public prev: Node<T> = null) {
  }
}

export class List<T> {

  private nil = new Node<T>();

  constructor() {
    this.clear();
  }

  public first(): Node<T> {
    return this.nil.next;
  }

  public last(): Node<T> {
    return this.nil.prev;
  }

  public terminator(): Node<T> {
    return this.nil;
  }

  public pop(): T {
    let ret = this.last().obj;
    this.remove(this.last());
    return ret;
  }

  public push(value: T): Node<T> {
    return this.insertAfter(value);
  }

  public pushAll(values: T[]): Node<T>[] {
    let nodes = [];
    for (let i = 0; i < values.length; i++)
      nodes.push(this.insertAfter(values[i]));
    return nodes;
  }

  public isEmpty(): boolean {
    return this.nil.next == this.nil;
  }

  public insertNodeBefore(node: Node<T>, ref: Node<T> = this.nil.next): Node<T> {
    node.next = ref;
    node.prev = ref.prev;
    node.prev.next = node;
    ref.prev = node;
    return node;
  }

  public insertBefore(val: T, ref: Node<T> = this.nil.next): Node<T> {
    return this.insertNodeBefore(new Node<T>(val), ref);
  }

  public insertNodeAfter(node: Node<T>, ref: Node<T> = this.nil.prev): Node<T> {
    node.next = ref.next;
    node.next.prev = node;
    ref.next = node;
    node.prev = ref;
    return node;
  }

  public insertAfter(val: T, ref: Node<T> = this.nil.prev): Node<T> {
    return this.insertNodeAfter(new Node<T>(val), ref);
  }

  public remove(ref: Node<T>): Node<T> {
    if (ref == this.nil)
      return;

    ref.next.prev = ref.prev;
    ref.prev.next = ref.next;
    return ref;
  }

  public clear() {
    this.nil.next = this.nil;
    this.nil.prev = this.nil;
  }
}

export class ListIterator<T> implements Iterator<T>, ForwardIterator, BackIterator, WriteIterator<T> {
  constructor(private node: Node<T>) { }
  get(): T { return this.node.obj; }
  set(value: T): void { this.node.obj = value; }
  next(): void { this.node = this.node.next; }
  back(): void { this.node = this.node.prev; }
  eq(iter: ListIterator<T>): boolean { return this.node === iter.node; }
}

export function startList<T>(list: List<T>): Iterator<T> {
  return new ListIterator<T>(list.first());
}

export function endList<T>(list: List<T>): Iterator<T> {
  return new ListIterator<T>(list.terminator());
}
