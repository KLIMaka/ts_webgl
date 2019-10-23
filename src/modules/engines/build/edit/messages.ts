import { Message } from "../handlerapi";
import { MovingHandle } from "./handle";
import { InputState } from "../../../input";
import { Hitscan } from "../hitscan";
import { Renderable } from "../gl/renderable";
import { Deck } from "../../../deck";
import { EventQueue } from "../../../eventqueue";


export class StartMove implements Message { constructor(public handle: MovingHandle) { } }
export class Move implements Message { constructor(public handle: MovingHandle) { } }
export class EndMove implements Message { constructor(public handle: MovingHandle) { } }
export class Highlight implements Message { constructor(public set: Set<number> = new Set()) { } }
export class Render implements Message { constructor(public list: Deck<Renderable> = new Deck()) { } }
export class SetPicnum implements Message { constructor(public picnum: number) { } }
export class ToggleParallax implements Message { }
export class Shade implements Message { constructor(public value: number, public absolute = false) { } }
export class PanRepeat implements Message { constructor(public xpan: number, public ypan: number, public xrepeat: number, public yrepeat: number, public absolute = false) { } }
export class Palette implements Message { constructor(public value: number, public max: number, public absolute = false) { } }
export class Flip implements Message { constructor() { } }
export class SpriteMode implements Message { }
export class Input implements Message { constructor(public state: InputState) { } }
export class EventBus implements Message { constructor(public events: EventQueue) { } }
export class Frame implements Message { constructor(public dt: number) { } }
export class HitScan implements Message { constructor(public hit: Hitscan) { } }
export class SetWallCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class SetSectorCstat implements Message { }