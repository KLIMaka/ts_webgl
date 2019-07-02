import { List } from "../../../libs/list";

export interface Message { }

export interface Context { }

export type MessageHandler = (message: Message, ctx: Context) => void;

export type InstanceMessageHandler<T> = (obj: T, message: Message, ctx: Context) => void;
export const DEFAULT_HANDLER = (obj: any, message: Message, ctx: Context) => { };

export function sendMessage(message: Message, ctx: Context, receivers: List<MessageHandler>) {
  for (let item = receivers.first(); item != receivers.terminator(); item = item.next) {
    item.obj(message, ctx);
  }
}

export class MessageHandlerFactory<T> {
  private handlers = new Map<Function, InstanceMessageHandler<T>>();
  private defaultHandler: InstanceMessageHandler<any> = DEFAULT_HANDLER;

  public register(constr: Function, receiver: InstanceMessageHandler<T>): MessageHandlerFactory<T> {
    this.handlers.set(constr, receiver);
    return this;
  }

  public setDefaultReceiver(receiver: MessageHandler): MessageHandlerFactory<T> {
    this.defaultHandler = receiver;
    return this;
  }

  public handler(obj: T): MessageHandler {
    return (message: Message, ctx: Context) => {
      let handler = this.handlers.get(message.constructor) || this.defaultHandler;
      handler(obj, message, ctx);
    }
  }
}