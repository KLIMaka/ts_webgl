import { Event, EventConsumer } from "../../eventqueue";
import { Lexer, LexerRule } from "../../lex/lexer";
import { Palette, PanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade } from "./edit/messages";
import { Message } from "./handlerapi";

let lexer = new Lexer();
lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
lexer.addRule(new LexerRule(/^[^ \t\r\v\n\(\)`"]+/, 'ID'));
lexer.addRule(new LexerRule(/^msg+/, 'MSG'));
lexer.addRule(new LexerRule(/^(false|true)+/, 'BOOLEAN', 0, (s) => s == 'true'));
lexer.addRule(new LexerRule(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, (s) => parseFloat(s)));
lexer.addRule(new LexerRule(/^\-?[0-9]+/, 'INT', 0, (s) => parseInt(s)));
lexer.addRule(new LexerRule(/^"([^"]*)"/, 'STRING', 1));

function get<T>(expected: string): T {
  if (lexer.isEoi()) throw new Error();
  for (; !lexer.isEoi() && lexer.next() == 'WS';);
  if (lexer.rule().name == 'WS' && lexer.isEoi()) throw new Error();
  let tokenId = lexer.rule().name;
  if (tokenId != expected) throw new Error();
  return lexer.value();
}

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
  let event = tryParse(str);
  if (event == null) return new StringEvent(str);
  return new MessageEvent(event);
}

function tryParse(src: string) {
  try {
    lexer.setSource(src);
    get('MSG');
    let type = get('ID');
    switch (type) {
      case 'picnum': return new SetPicnum(get('INT'));
      case 'shade': return new Shade(get('INT'), get('BOOLEAN'));
      case 'panrepeat': return new PanRepeat(get('INT'), get('INT'), get('INT'), get('INT'), get('BOOLEAN'));
      case 'pal': return new Palette(get('INT'), 15, get('BOOLEAN'));
      case 'wallcstat': return new SetWallCstat(get('ID'), get('BOOLEAN'), get('BOOLEAN'));
      case 'sectorcstat': return new SetSectorCstat(get('ID'), get('BOOLEAN'), get('BOOLEAN'));
      default: return null;
    }
  } catch (e) {
    return null;
  }
}