import { Message } from "../handlerapi";
import { BuildContext } from "../api";
import { WallStats } from "../structs";

export type WallProcessor = (wallId: number, ctx: BuildContext) => boolean;
export class WallMesage implements Message { constructor(public proc: WallProcessor) { } }

const setWallCstat = (name: keyof WallStats, value: number) => (wallId: number, ctx: BuildContext) => ctx.board.walls[wallId].cstat[name] = value;
const getWallCstat = (name: keyof WallStats) => (wallId: number, ctx: BuildContext) => ctx.board.walls[wallId].cstat[name];



export function cstat(name: keyof WallStats, value: number): WallProcessor {
  return (wallId: number, ctx: BuildContext): boolean => {
    let wall = ctx.board.walls[wallId];
    let stat = wall.cstat[name];
    if (stat == value) return false;
    wall.cstat[name] = value;
    return true;
  }
}