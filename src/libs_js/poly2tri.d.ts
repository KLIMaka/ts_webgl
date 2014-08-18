export declare class Point {
  x:number;
  y:number;
  constructor(x:number, y:number);
}

export declare class Triangle {
  constructor(p1:Point, p2:Point, p3:Point);
  GetPoint(i:number):Point;
}

export declare class SweepContext {
  constructor(contour:Point[]);
  addHole(contour:Point[]):void;
  getTriangles():Triangle[];
}

export declare module sweep {
  export function Triangulate(ctx:SweepContext):void;
}




