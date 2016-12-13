import lex = require('./lexer');

export class Capture {

  constructor(
    public value:any=null, 
    public name:string=null) 
  {}

  public isValid():boolean {
    return this.value != null
  }
}

export var InvalidCapture = new Capture();

export class Parser {

  constructor(private lexer:lex.Lexer, private skipper:(string)=>boolean) {
  }

  public exec(rule:ParserRule):Capture {
    this.next();
    return rule.match(this);
  }

  public next():void {
    var lex = this.lexer;
    var skipper = this.skipper;
    while(skipper(lex.next()));
  }

  public lex():lex.Lexer {
    return this.lexer;
  }
}

export interface ParserRule {
  match(parser:Parser):Capture;
}

export class SimpleParserRule implements ParserRule {

  constructor(private id:string) {}

  public match(parser:Parser):Capture {
    if (parser.lex().rule().name != this.id)
      return InvalidCapture;
    return new Capture(parser.lex().value()); 
  }
}

export class BindingParserRule implements ParserRule {

  constructor(private name:string, private rule:ParserRule) {}

  public match(parser:Parser):Capture {
    var res = this.rule.match(parser);
    if (!res.isValid())
      return res;
    return new Capture(res, this.name); 
  }
}

export class OrParserRule implements ParserRule {

  constructor(private rules:ParserRule[]) {}

  public match(parser:Parser):Capture {
    for (var i = 0; i < this.rules.length; i++) {
      var rule = this.rules[i];
      var res = rule.match(parser);
      if (!res.isValid())
        continue;
      return new Capture(res);
    }
    return InvalidCapture; 
  }
}

export class AndParserRule implements ParserRule {

  constructor(private rules:ParserRule[]) {}

  public match(parser:Parser):Capture {
    var arr = [];
    var mark = parser.lex().mark();
    for (var i = 0; i < this.rules.length; i++) {
      var rule = this.rules[i];
      var res = rule.match(parser);
      if (!res.isValid()) {
        parser.lex().reset(mark);
        return res;
      }
      arr.push(res);
      if (i != this.rules.length-1)
        parser.next();
    }
    return new Capture(arr); 
  }
}

export class CountParserRule implements ParserRule {

  constructor(private rule:ParserRule, private from=0, private to=0) {}

  public match(parser:Parser):Capture {
    var arr = [];
    var i = 0;
    var begin = parser.lex().mark();
    var mark = begin;
    var capt = {};
    while (true) {
      if (this.to > 0 && this.to == i) {
        parser.lex().reset(mark);
        break;
      }
      var lastMark = parser.lex().mark();
      var res = this.rule.match(parser);
      if (!res.isValid()) {
        if (i < this.from) {
          parser.lex().reset(begin);
          return res;
        } else {
          parser.lex().reset(mark);
          return new Capture(arr);
        }
      }
      arr.push(res);
      mark = parser.lex().mark();
      parser.next();
      i++;
    }
    return new Capture(arr); 
  }
}

export function captureParser(capt:Capture, res={}):any {
  if (capt.name == null) {

  } else if {
    res[capt.name] = captureParser(capt.value);
  }
  return res;
}