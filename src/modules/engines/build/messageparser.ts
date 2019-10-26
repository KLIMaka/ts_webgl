import { Lexer, LexerRule } from "../../lex/lexer";
import { Flip, NamedMessage, Palette, PanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade, SpriteMode, ResetPanRepeat, StartMove, EndMove, Move } from "./edit/messages";
import { Message } from "./handlerapi";
import { Collection, Deck } from "../../collections";
import { debug } from "../../logger";

class MessageParser {
  private lexer = new Lexer();

  constructor() {
    this.lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
    this.lexer.addRule(new LexerRule(/^[a-zA-Z_][a-zA-Z0-9_]+/, 'ID'));
    this.lexer.addRule(new LexerRule(/^,/, 'COMA'));
    this.lexer.addRule(new LexerRule(/^(false|true)/, 'BOOLEAN', 0, (s) => s == 'true'));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, (s) => parseFloat(s)));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]+/, 'INT', 0, (s) => parseInt(s)));
    this.lexer.addRule(new LexerRule(/^"([^"]*)"/, 'STRING', 1));
  }

  public setSource(src: string): void {
    this.lexer.setSource(src);
  }

  public get<T>(expected: string, value: T = null): T {
    for (; this.lexer.next() == 'WS';);
    if (this.lexer.isEoi()) throw new Error();
    let tokenId = this.lexer.rule().name;
    let actual = this.lexer.value();
    if (tokenId != expected || value != null && value != actual) throw new Error();
    return this.lexer.value();
  }


}

let parser = new MessageParser();

function tryParseMessage(): Message {
  switch (parser.get('ID')) {
    case 'picnum': return new SetPicnum(parser.get('INT'));
    case 'shade': return new Shade(parser.get('INT'), parser.get('BOOLEAN'));
    case 'panrepeat': return new PanRepeat(parser.get('INT'), parser.get('INT'), parser.get('INT'), parser.get('INT'), parser.get('BOOLEAN'));
    case 'pal': return new Palette(parser.get('INT'), 15, parser.get('BOOLEAN'));
    case 'wallcstat': return new SetWallCstat(parser.get('ID'), parser.get('BOOLEAN'), parser.get('BOOLEAN'));
    case 'sectorcstat': return new SetSectorCstat(parser.get('ID'), parser.get('BOOLEAN'), parser.get('BOOLEAN'));
    case 'flip': return new Flip();
    case 'sprite_mode': return new SpriteMode();
    case 'reset_panrepeat': return new ResetPanRepeat();
    case 'start_move': return new StartMove();
    case 'end_move': return new EndMove();
    case 'move': return new Move({ dx: parser.get('INT'), dy: parser.get('INT'), dz: parser.get('INT') });
    default: return null;
  }
}

function tryParse(src: string, messages: Deck<Message>): Collection<Message> {
  try {
    parser.setSource(src);
    parser.get('ID', 'msg');
    let msg = tryParseMessage();
    while (msg != null) {
      messages.push(msg);
      try { parser.get('COMA') } catch (e) { break }
      msg = tryParseMessage();
    }
    return messages;
  } catch (e) {
    return messages.clear();
  }
}

let messages = new Deck<Message>();
export function messageParser(str: string): Collection<Message> {
  let result = tryParse(str, messages.clear());
  if (result.length() == 0) return messages.push(new NamedMessage(str));
  return result;
}