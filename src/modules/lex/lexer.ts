
export class LexerRule {
  public id:number = null;
  constructor(public pattern:RegExp, public name:string, public mid = 0) {}
}

export class Lexer {

  private rulesByName = {};
  private rulesByPatt = {};
  private rules:LexerRule[] = [];
  private src:string;
  private offset = 0;
  private lastOffset = 0;
  private eoi = false;

  private matchedRule:LexerRule = null;
  private matchedValue = null;

  public addRule(rule:LexerRule):Lexer {
    var r = this.rulesByName[rule.name];
    if (r == undefined) {
      rule.id = this.rules.length;
      this.rules.push(rule);
    } else {
      throw new Error('Rule ' + rule.name + ' already exist');
    }

    this.rulesByName[rule.name] = rule;
    //this.rulesByPatt[rule.pattern] = rule;
    return this;
  }

  public mark():number {
    return this.lastOffset;
  }

  public reset(offset:number = 0):string {
    this.offset = offset;
    this.lastOffset = offset;
    this.eoi = false;
    return this.next();
  }

  public setSource(src:string):void {
    this.src = src;
    this.offset = 0;
    this.eoi = false;
  }

  private exec():string {
    if (this.eoi)
      return null;

    var len = 0;
    var matchedValue = null;
    var matchedRule:LexerRule = null;
    var subsrc = this.src.substr(this.offset);
    for (var i = 0; i < this.rules.length; i++) {
      var rule = this.rules[i];
      var match = rule.pattern.exec(subsrc);
      if (match != null && match[0].length >= len) {
        matchedValue = match;
        matchedRule = rule;
        len = match[0].length;
      }
    }

    this.matchedRule = matchedRule;
    this.matchedValue = matchedValue;
    this.lastOffset = this.offset;
    this.offset += len;

    if(this.offset >= this.src.length)
      this.eoi = true;

    if (matchedRule == null)
      throw new Error('Unexpected input "'+ subsrc.substr(0, 10) + '..."');

    return matchedRule.name; 
  }

  public next():string {
    return this.exec()
  }

  public rule():LexerRule {
    return this.matchedRule;
  }

  public value():string {
    return this.matchedValue[this.rule().mid];
  }
}

export class NoopCapture {
  public put(value:any):void {}  
}

export class SetCapture {

  constructor(private name:string, private map = {}) {}

  public put(value:any):void {
    this.map[this.name] = value;
  }
}

export class AddCapture {

  constructor(private name:string, private map = {}) {}

  public put(value:any):void {
    var arr = this.map[this.name];
    if (arr == undefined) {
      arr = [value];
      this.map[this.name] = arr;
    } else {
      arr.push(value);
    }
  }
}


export class Capture {

  constructor(private value:any=null, private name:string=null) {}

  public isValid():boolean {
    return this.value != null
  }
}

export var InvalidCapture = new Capture();

export class Parser {

  constructor(private lexer:Lexer, private skipper:(string)=>boolean) {
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

  public lex():Lexer {
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
