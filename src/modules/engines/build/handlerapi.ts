import { Deck } from "../../deck";
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

export class MessageHandlerList implements MessageHandler {
  private receivers: Deck<MessageHandler> = new Deck();

  handle(message: Message, ctx: Context) {
    for (let i = 0; i < this.receivers.length(); i++) {
      this.receivers.get(i).handle(message, ctx);
    }
  }

  public clear() {
    this.receivers.clear();
  }

  public isEmpty() {
    return this.receivers.length() == 0;
  }

  public add(handler: MessageHandler) {
    this.receivers.push(handler);
  }

  public clone(): MessageHandlerList {
    let copy = new MessageHandlerList();
    copy.receivers = this.receivers.clone();
    return copy;
  }
}