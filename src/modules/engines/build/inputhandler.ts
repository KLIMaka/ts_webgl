import { BuildContext } from "./edit/editapi";
import { Controller3D } from "../../controller3d";
import * as PROFILE from "../../profiler";
import * as INPUT from "../../input";
import { hitscan, Hitscan } from "./hitscan";
import { MoveStruct } from "./utils";

export class InputHandler {
  private context: BuildContext;
  private camera: Controller3D;
  private hit = new Hitscan();
  private moveStruct: MoveStruct;

  public handle() {

  }

  private updateHit(gl: WebGLRenderingContext) {
    PROFILE.startProfile('hitscan');
    let [vx, vz, vy] = this.camera.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
    hitscan(this.context.board, this.context.art, this.moveStruct.x, this.moveStruct.y, this.moveStruct.z, this.moveStruct.sec, vx, vy, vz, this.hit, 0);
    PROFILE.endProfile();
  }
}