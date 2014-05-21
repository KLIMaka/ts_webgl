
var id = (s:string) => s;

export class LexerRule {
  public id:number = null;
  constructor(public pattern:RegExp, public name:string, public mid = 0, public conv:(string)=>any = id ) {}
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
    return this.rule().conv(this.matchedValue[this.rule().mid]);
  }
}
