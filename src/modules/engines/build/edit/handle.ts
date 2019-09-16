import { len2d } from "../../../../libs/mathutils";
import { Hitscan } from "../hitscan";
import { Board } from "../structs";
import { ZSCALE } from "../utils";
import * as GLM from "../../../../libs_js/glmatrix";

export class MovingHandle {
  private startPoint = GLM.vec3.create();
  private currentPoint = GLM.vec3.create();
  private dzoff = 0;
  private active = false;
  public mod1 = false;
  public mod2 = false;
  public mod3 = false;
  public hit: Hitscan;

  public start(hit: Hitscan) {
    this.hit = hit;
    GLM.vec3.set(this.startPoint, hit.x, hit.z / ZSCALE, hit.y);
    GLM.vec3.copy(this.currentPoint, this.startPoint);
    this.dzoff = 0;
    this.active = true;
  }

  public update(s: GLM.Vec3Array, v: GLM.Vec3Array, mod1: boolean, mod2: boolean, mod3: boolean, hit: Hitscan, board: Board) {
    this.mod1 = mod1;
    this.mod2 = mod2;
    this.mod3 = mod3;
    this.hit = hit;

    if (mod2) {
      let dx = this.currentPoint[0] - s[0];
      let dy = this.currentPoint[2] - s[2];
      let t = len2d(dx, dy) / len2d(v[0], v[2]);
      this.dzoff = v[1] * t + s[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      let dz = this.startPoint[1] - s[1];
      let t = dz / v[1];
      GLM.vec3.copy(this.currentPoint, v);
      GLM.vec3.scale(this.currentPoint, this.currentPoint, t);
      GLM.vec3.add(this.currentPoint, this.currentPoint, s);
    }
  }

  public isActive() { return this.active; }
  public stop() { this.active = false; }
  public dx() { return this.mod1 && Math.abs(this.dx_()) < Math.abs(this.dy_()) ? 0 : this.dx_(); }
  public dy() { return this.mod1 && Math.abs(this.dy_()) < Math.abs(this.dx_()) ? 0 : this.dy_(); }
  public dz() { return this.mod2 ? this.currentPoint[1] - this.startPoint[1] + this.dzoff : 0; }
  private dx_() { return this.currentPoint[0] - this.startPoint[0]; }
  private dy_() { return this.currentPoint[2] - this.startPoint[2]; }
}
