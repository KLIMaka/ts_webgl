
export type Interpolator<T> = (lh:T, rh:T, t:number) => T;

export var NumberInterpolator = (lh:number, rh:number, t:number) => {
  return lh + (rh-lh) * t;
}

export var Vec3Interpolator = (lh:number[], rh:number[], t:number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t
  ]
}

export var Vec4Interpolator = (lh:number[], rh:number[], t:number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t,
    lh[3] + (rh[3] - lh[3]) * t
  ]
}

export class Point<T> {
  constructor(public val:T, public pos:number) {}
}

export function PointComparator<T>(lh:Point<T>, rh:Point<T>) {
  return lh.pos - rh.pos;
}

export class Range<T> {
  private points:Array<Point<T>> = [];

  constructor(start:T, end:T, private interpolator:Interpolator<T>) {
    this.points.push(new Point<T>(start, 0));
    this.points.push(new Point<T>(end, 1));
  }

  public insert(val:T, t:number):void {
    var idx = binaryIndexOf(this.points, new Point<T>(null, t), PointComparator);
    this.points.splice(idx+1, 0, new Point<T>(val, t));
  }

  public get(t:number):T {
    var idx = binaryIndexOf(this.points, new Point<T>(null, t), PointComparator);
    var lh = this.points[idx];
    var rh = this.points[idx+1];
    var localT = (t-lh.pos)/(rh.pos-lh.pos);
    return this.interpolator(lh.val, rh.val, localT);
  }
}

export type Comparator<T> = (lh:T, rh:T) => number;

export function binaryIndexOf<T>(arr:Array<T>, searchElement:T, cmp:Comparator<T>, minIndex:number=0, maxIndex:number=arr.length-1) {
  var refMinIndex = minIndex;
  if (cmp(searchElement, arr[minIndex]) < 0 || cmp(searchElement, arr[maxIndex]) > 0)
    return -1;
  while (minIndex <= maxIndex) {
    var currentIndex = (minIndex + maxIndex) / 2 | 0;
    var currentElement = arr[currentIndex];
    var cmpVal = cmp(currentElement, searchElement);
    if (cmpVal < 0) minIndex = currentIndex + 1;
    else if (cmpVal > 0) maxIndex = currentIndex - 1;
    else break;
  }
  return currentIndex == refMinIndex ? refMinIndex : currentIndex - 1;
}