import { Lexer, LexerRule } from "../../lex/lexer";
import { Flip, NamedMessage, Palette, PanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade, SpriteMode, ResetPanRepeat, StartMove, EndMove, Move } from "./edit/messages";
import { Message } from "./handlerapi";
import { Collection, Deck } from "../../deck";

let lexer = new Lexer();
lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
lexer.addRule(new LexerRule(/^[^ \t\r\v\n\(\)`"]+/, 'ID'));
lexer.addRule(new LexerRule(/^,/, 'COMA'));
lexer.addRule(new LexerRule(/^(false|true)/, 'BOOLEAN', 0, (s) => s == 'true'));
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

function tryParseMessage(): Message {
  switch (get('ID')) {
    case 'picnum': return new SetPicnum(get('INT'));
    case 'shade': return new Shade(get('INT'), get('BOOLEAN'));
    case 'panrepeat': return new PanRepeat(get('INT'), get('INT'), get('INT'), get('INT'), get('BOOLEAN'));
    case 'pal': return new Palette(get('INT'), 15, get('BOOLEAN'));
    case 'wallcstat': return new SetWallCstat(get('ID'), get('BOOLEAN'), get('BOOLEAN'));
    case 'sectorcstat': return new SetSectorCstat(get('ID'), get('BOOLEAN'), get('BOOLEAN'));
    case 'flip': return new Flip();
    case 'sprite_mode': return new SpriteMode();
    case 'reset_panrepeat': return new ResetPanRepeat();
    case 'start_move': return new StartMove();
    case 'end_move': return new EndMove();
    case 'move': return new Move({ dx: get('INT'), dy: get('INT'), dz: get('INT') });
    default: return null;
  }
}

function tryParse(src: string, messages: Deck<Message>): Collection<Message> {
  try {
    lexer.setSource(src);
    if (get('ID') != 'msg') throw new Error();
    let msg = tryParseMessage();
    while (msg != null) {
      messages.push(msg);
      try { get('COMA') } catch (e) { break }
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