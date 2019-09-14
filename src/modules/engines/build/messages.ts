import { List } from "../../../libs/list";

export interface Message { }

export interface Context { }

export interface MessageHandler {
  handle(message: Message, ctx: Context): void;
}

export function sendMessage(message: Message, ctx: Context, receivers: List<MessageHandler>) {
  for (let item = receivers.first(); item != receivers.terminator(); item = item.next) {
    item.obj.handle(message, ctx);
  }
}

export class MessageHandlerIml {

  handle(message: Message, ctx: Context) {
    let name = message.constructor.name;
    let handler = this[name];
    if (handler != undefined) {
      handler.apply(this, [message, ctx]);
    } else {
      this.handleDefault(message, ctx);
    }
  }

  handleDefault(message: Message, ctx: Context) { }
}