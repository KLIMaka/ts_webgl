
export type Interpolator<T> = (lh: T, rh: T, t: number) => T;

export let NumberInterpolator = (lh: number, rh: number, t: number) => {
  return lh + (rh - lh) * t;
}

export let Vec3Interpolator = (lh: number[], rh: number[], t: number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t
  ]
}

export let Vec4Interpolator = (lh: number[], rh: number[], t: number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t,
    lh[3] + (rh[3] - lh[3]) * t
  ]
}

export class Point<T> {
  constructor(public val: T, public pos: number, public interpolator: Interpolator<T>) { }
}

export function PointComparator<T>(lh: Point<T>, rh: Point<T>) {
  return lh.pos - rh.pos;
}

export class Range<T> {
  private points: Array<Point<T>> = [];

  constructor(start: T, end: T, interpolator: Interpolator<T>) {
    this.points.push(new Point<T>(start, 0, interpolator));
    this.points.push(new Point<T>(end, 1, null));
  }

  public insert(val: T, t: number, interpolator: Interpolator<T>): void {
    let idx = binaryIndexOf(this.points, new Point<T>(null, t, null), PointComparator);
    this.points.splice(idx + 1, 0, new Point<T>(val, t, interpolator));
  }

  public get(t: number): T {
    let idx = binaryIndexOf(this.points, new Point<T>(null, t, null), PointComparator);
    let lh = this.points[idx];
    let rh = this.points[idx + 1];
    let localT = (t - lh.pos) / (rh.pos - lh.pos);
    return lh.interpolator(lh.val, rh.val, localT);
  }
}

export type Comparator<T> = (lh: T, rh: T) => number;

export function binaryIndexOf<T>(arr: Array<T>, searchElement: T, cmp: Comparator<T>, minIndex: number = 0, maxIndex: number = arr.length - 1) {
  let refMinIndex = minIndex;
  if (cmp(searchElement, arr[minIndex]) < 0 || cmp(searchElement, arr[maxIndex]) > 0)
    return -1;
  let currentIndex = 0;
  let currentElement: T = null;
  while (minIndex <= maxIndex) {
    currentIndex = (minIndex + maxIndex) / 2 | 0;
    currentElement = arr[currentIndex];
    let cmpVal = cmp(currentElement, searchElement);
    if (cmpVal < 0) minIndex = currentIndex + 1;
    else if (cmpVal > 0) maxIndex = currentIndex - 1;
    else break;
  }
  return currentIndex == refMinIndex ? refMinIndex : currentIndex - 1;
}