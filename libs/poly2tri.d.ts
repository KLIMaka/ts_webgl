export declare module js {

  export module poly2tri {

    export class Point {
      x:number;
      y:number;
      constructor(x:number, y:number);
    }

    export class Triangle {
      constructor(p1:Point, p2:Point, p3:Point);
      GetPoint(i:number):Point;
    }

    export class SweepContext {
      constructor(contour:Point[]);
      AddHole(contour:Point[]):void
      GetTriangles():Triangle[];
    }

    export module sweep {
      export function Triangulate(ctx:js.poly2tri.SweepContext):void;
    }

  }
}



