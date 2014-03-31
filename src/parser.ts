import lex = require('./modules/lex/lexer');
import getter = require('./libs/getter');

var LR = lex.LexerRule;
var SPR = lex.SimpleParserRule;
var AND = (rules:any[]) => new lex.AndParserRule(rules);
var BIND = (id:string, rule:lex.ParserRule) => new lex.BindingParserRule(id, rule);
var OR = (rules:lex.ParserRule[]) => new lex.OrParserRule(rules);
var COUNT = (rule:lex.ParserRule, from:number, to:number) => new lex.CountParserRule(rule, from, to);
var PLUS = (rule:lex.ParserRule) => COUNT(rule, 1, 0);
var STAR = (rule:lex.ParserRule) => COUNT(rule, 0, 0);
var MAY = (rule:lex.ParserRule) => COUNT(rule, 0, 1);

var lexer = new lex.Lexer();
lexer.addRule(new LR(/^[_A-Za-z][_A-Za-z0-9]*/,      'ID'));
lexer.addRule(new LR(/^function/,      'function'));
lexer.addRule(new LR(/^:/,           ':'));
lexer.addRule(new LR(/^;/,           ';'));
lexer.addRule(new LR(/^\n+/,         'NL'));
lexer.addRule(new LR(/^[ \t]+/,      'WS'));
lexer.addRule(new LR(/^'(.*[^\\])'/, 'RULE', 1));
lexer.addRule(new LR(/^\/\/.*\n/,    'LINECOMM'));
lexer.addRule(new LR(/^\/\*[\s\S]*\*\//,  'CCOMM'));
lexer.addRule(new LR(/^\(/,  '('));
lexer.addRule(new LR(/^\)/,  ')'));
lexer.addRule(new LR(/^\,/,  ','));

lexer.setSource(getter.getString('resources/parser/parsdef.txt')); 


var skipper = (id:string) => {
  if (id == 'WS' || id == 'NL' || id == 'LINECOMM' || id == 'CCOMM')
    return true;
  return false;
}

var p = new lex.Parser(lexer, skipper);
var FUNC = new SPR('function');
var ID = new SPR('ID');
var RULE = new SPR('RULE');
var COL = new SPR(':');
var SCOL = new SPR(';');
var NL = new SPR('NL');
var LP = new SPR('(');
var RP = new SPR(')');
var COM = new SPR(',');

var r = AND([FUNC, BIND('fname', ID), LP, MAY(BIND('args', AND([BIND('arg', ID), STAR(AND([COM, BIND('arg', ID)]))]))), RP]);
// FUNC : 'function' fname=ID '(' (args+=ID (',' args+=ID)*)? ')'
// TUPED_DEF : name=ID ':' type=ID;
// FUNC : rettype=ID 'function' fname=ID '(' (args+=TYPED_DEF (',' args+=TYPED_DEF)*)? ')'


console.log(p.exec(r)); 