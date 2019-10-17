import { Deck, Collection } from "../../deck";
import { tuple2 } from "../../../libs/mathutils";

export interface Message { }

export interface Context { }

export interface MessageHandler {
  handle(message: Message, ctx: Context): void;
}

let args: [Message, Context] = [null, null];
export function handleReflective(obj: Object, message: Message, ctx: Context) {
  let name = message.constructor.name;
  let handler = obj[name];
  if (handler != undefined) {
    handler.apply(obj, tuple2(args, message, ctx));
    return true;
  }
  return false;
}

export class MessageHandlerReflective {
  public handle(message: Message, ctx: Context) { if (!handleReflective(this, message, ctx)) this.handleDefault(message, ctx) }
  protected handleDefault(message: Message, ctx: Context) { }
}

export class MessageHandlerList extends Deck<MessageHandler> implements MessageHandler {
  handle(message: Message, ctx: Context) {
    for (let i = 0; i < this.length(); i++) {
      this.get(i).handle(message, ctx);
    }
  }

  clone(): MessageHandlerList {
    return <MessageHandlerList>super.clone();
  }
}