import { Deck } from "../../deck";

export interface Message { }

export interface Context { }

export interface MessageHandler {
  handle(message: Message, ctx: Context): void;
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
    let list = new MessageHandlerList();
    for (let i = 0; i < this.receivers.length(); i++)
      list.add(this.receivers.get(i));
    return list;
  }
}