import lex = require('./modules/lex/lexer');
import pars = require('./modules/lex/parser');
import getter = require('./libs/getter');

var LR = lex.LexerRule;
var SPR = pars.SimpleParserRule;
var AND = (rules:any[]) => new pars.AndParserRule(rules);
var BIND = (id:string, rule:pars.ParserRule) => new pars.BindingParserRule(id, rule);
var OR = (rules:pars.ParserRule[]) => new pars.OrParserRule(rules);
var COUNT = (rule:pars.ParserRule, from:number, to:number) => new pars.CountParserRule(rule, from, to);
var PLUS = (rule:pars.ParserRule) => COUNT(rule, 1, 0);
var STAR = (rule:pars.ParserRule) => COUNT(rule, 0, 0);
var MAY = (rule:pars.ParserRule) => COUNT(rule, 0, 1);

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

getter.preloadString('resources/parser/parsdef.txt', (s) => {

lexer.setSource(s); 
var skipper = (id:string) => {
  if (id == 'WS' || id == 'NL' || id == 'LINECOMM' || id == 'CCOMM')
    return true;
  return false;
}

var p = new pars.Parser(lexer, skipper);
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
  
});

