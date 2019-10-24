import { Event, EventConsumer } from "../../eventqueue";
import { Message } from "./handlerapi";
import { SetPicnum, Shade, PanRepeat, Palette, SetWallCstat, SetSectorCstat } from "./edit/messages";
import { error } from "../../logger";


export class StringEvent implements Event {
  constructor(readonly name: string) { }
}

export function stringEventConsumer<T>(name: string, action: (ctx: T) => void): EventConsumer<T> {
  return (e: Event, ctx: T) => { if (e instanceof StringEvent && e.name == name) { action(ctx); return true } return false }
}

export function multistringEventConsumer<T>(action: (name: string, ctx: T) => boolean): EventConsumer<T> {
  return (e: Event, ctx: T) => e instanceof StringEvent && action(e.name, ctx);
}

export class MessageEvent implements Event {
  constructor(readonly message: Message) { }
}

export function messageEventConsumer<T>(action: (message: Message, ctx: T) => void): EventConsumer<T> {
  return (e: Event, ctx: T) => { if (e instanceof MessageEvent) { action(e.message, ctx); return true } return false }
}

export function eventParser(str: string): Event {
  let parts = str.split(/ +/);
  let keyword = parts.shift();
  if (keyword == 'msg') {
    let message = parseMessage(parts);
    if (message == null) {
      error(`Cannot parse ${str}`);
      return null;
    }
    return new MessageEvent(message);
  }
  return new StringEvent(str);
}

export function parseMessage(parts: string[]): Message {
  let int = Number.parseInt;
  let type = parts.shift();
  if (type == 'picnum') return new SetPicnum(int(parts.shift()));
  else if (type == 'shade') return new Shade(int(parts.shift()), parts.shift() == 'true');
  else if (type == 'panrepeat') return new PanRepeat(int(parts.shift()), int(parts.shift()), int(parts.shift()), int(parts.shift()), parts.shift() == 'true');
  else if (type == 'pal') return new Palette(int(parts.shift()), 15, parts.shift() == 'true');
  else if (type == 'wallcstat') return new SetWallCstat(parts.shift(), parts.shift() == 'true', parts.shift() == 'true');
  else if (type == 'sectorcstat') return new SetSectorCstat(parts.shift(), parts.shift() == 'true', parts.shift() == 'true');
  return null;
}