import * as PROFILE from "../../profiler";
import { BuildContext, View } from "./api";
import { PostFrame } from "./edit/messages";
import { MessageHandlerReflective } from "./handlerapi";


export class Statusbar extends MessageHandlerReflective {
  xpos: HTMLElement;
  ypos: HTMLElement;
  secpos: HTMLElement;
  fps: HTMLElement;
  draws: HTMLElement;

  constructor() {
    super();
    this.xpos = document.getElementById('x_position');
    this.ypos = document.getElementById('y_position');
    this.secpos = document.getElementById('sector_position');
    this.fps = document.getElementById('fps');
    this.draws = document.getElementById('draws');
  }

  public PostFrame(msg: PostFrame, ctx: BuildContext) {
    let view = ctx.view;
    this.xpos.textContent = '' + view.x;
    this.ypos.textContent = '' + view.y;
    this.secpos.textContent = '' + view.sec;
    this.fps.textContent = (1000 / PROFILE.get(null).time).toFixed(0);
    const draws = PROFILE.get(null).counts['draws'] | 0;
    const skips = PROFILE.get(null).counts['skip_draws'] | 0;
    this.draws.textContent = '' + draws + ' / ' + (100 * (skips / draws)).toFixed(2) + '%';

    // info['Rendering:'] = PROFILE.get('draw').time.toFixed(2) + 'ms';
    // info['Processing:'] = PROFILE.get('processing').time.toFixed(2) + 'ms';
    // info['Hitscan:'] = PROFILE.get('hitscan').time.toFixed(2) + 'ms';
    // info['Sectors:'] = PROFILE.get('processing').counts['sectors'];
    // info['Walls:'] = PROFILE.get('processing').counts['walls'];
    // info['Sprites:'] = PROFILE.get('processing').counts['sprites'];
    // info['PVS:'] = PROFILE.get(null).counts['pvs'] || 0;
    // info['RORs:'] = PROFILE.get(null).counts['rors'];
    // info['Mirrors:'] = PROFILE.get(null).counts['mirrors'];
    // info['Buffer Traffic:'] = ((PROFILE.get(null).counts['traffic'] || 0) / 1024).toFixed(2) + 'k';
    // info['Buffer Updates:'] = PROFILE.get(null).counts['updates'] || 0;
    // info['Buffer Usage:'] = (100 * PROFILE.get(null).counts['buffer']).toFixed(2) + '%';
    // info['Draw Calls:'] = PROFILE.get(null).counts['draws'];
  }
}