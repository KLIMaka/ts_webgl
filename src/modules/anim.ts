import * as MU from '../libs/mathutils';

export interface Animated<T> {
  start(time:number):void;
  stop():void;
  animate(secs:number):T;
}

export class DefaultAnimated<T> implements Animated<T> {

  private start_t = -1;
  private currentFrame = 0;

  constructor(
    private frames:T[],
    private fps:number
    )
  {}

  public start(secs:number): void {
    this.start_t = secs;
  }

  public isStarted(): boolean {
    return this.start_t != -1;
  }

  public stop(): void {
    this.start_t = -1;
  }

  public animate(secs:number): T {
    if (this.start_t == -1)
      return this.frames[this.currentFrame];
    var dt = secs - this.start_t;
    var df = MU.int(dt * this.fps);
    this.currentFrame = df  % this.frames.length;
    return this.frames[this.currentFrame];
  }
}
