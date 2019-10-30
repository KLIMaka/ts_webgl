import { len2d } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { Hitscan } from "../hitscan";
import { ZSCALE } from "../utils";

export class MovingHandle {
  private startPoint = GLM.vec3.create();
  private currentPoint = GLM.vec3.create();
  private dzoff = 0;
  private active = false;
  private vertical = false;
  private parallel = false;

  public start(hit: Hitscan) {
    if (hit.t == -1) GLM.vec3.copy(this.startPoint, hit.startzscaled);
    else GLM.vec3.set(this.startPoint, hit.x, hit.z / ZSCALE, hit.y);
    GLM.vec3.copy(this.currentPoint, this.startPoint);
    this.dzoff = 0;
    this.active = true;
  }

  public update(vertical: boolean, parallel: boolean, hit: Hitscan) {
    this.parallel = parallel;
    this.vertical = vertical;
    if (vertical) {
      let dx = this.currentPoint[0] - hit.startzscaled[0];
      let dy = this.currentPoint[2] - hit.startzscaled[2];
      let t = len2d(dx, dy) / len2d(hit.veczscaled[0], hit.veczscaled[2]);
      this.dzoff = hit.veczscaled[1] * t + hit.startzscaled[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      let dz = this.startPoint[1] - hit.startzscaled[1];
      let t = dz / hit.veczscaled[1];
      GLM.vec3.copy(this.currentPoint, hit.veczscaled);
      GLM.vec3.scale(this.currentPoint, this.currentPoint, t);
      GLM.vec3.add(this.currentPoint, this.currentPoint, hit.startzscaled);
    }
  }

  public isActive() { return this.active; }
  public stop() { this.active = false; }
  public get dx() { return this.parallel && Math.abs(this.dx_()) < Math.abs(this.dy_()) ? 0 : this.dx_(); }
  public get dy() { return this.parallel && Math.abs(this.dy_()) < Math.abs(this.dx_()) ? 0 : this.dy_(); }
  public get dz() { return this.vertical ? this.currentPoint[1] - this.startPoint[1] + this.dzoff : 0; }
  private dx_() { return this.currentPoint[0] - this.startPoint[0]; }
  private dy_() { return this.currentPoint[2] - this.startPoint[2]; }
}
