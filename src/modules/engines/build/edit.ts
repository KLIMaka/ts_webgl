import { List } from "../../../libs/list";

export interface Message { }

export type MessageReceiver = (message: Message) => void;
export const DEFAULT_RECEIVER = (message: Message) => { };

export function sendMessage(message: Message, receivers: List<MessageReceiver>) {
  for (let item = receivers.first(); item != receivers.terminator(); item = item.next) {
    item.obj(message);
  }
}

export class RegistrableMessageReceiver {
  private dispatchers = new Map<Function, MessageReceiver>();
  private defaultReceiver: MessageReceiver = DEFAULT_RECEIVER;

  protected register(constr: Function, receiver: MessageReceiver) {
    this.dispatchers.set(constr, receiver);
  }

  protected setDefaultReceiver(receiver: MessageReceiver) {
    this.defaultReceiver = receiver;
  }

  public receiver(): MessageReceiver {
    return (message:Message) => {
      let receiver = this.dispatchers.get(message.constructor) || this.defaultReceiver;
      receiver(message);
    }
  }
}