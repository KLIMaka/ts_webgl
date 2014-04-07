import lex = require('./modules/lex/lexer');
import pars = require('./modules/lex/parser');
import getter = require('./libs/getter');

var LR = lex.LexerRule;

var lexer = new lex.Lexer();
lexer.addRule(new LR(/^[ \t\r\v]+/, 'WS'))
lexer.addRule(new LR(/^\n/, 'NL'))
lexer.addRule(new LR(/^\/\/[^\n]*/, 'COMM'))
lexer.addRule(new LR(/^[_A-Za-z][_A-Za-z0-9]*/, 'ID'));
lexer.addRule(new LR(/^[0-9]+/, 'INT', 0, parseInt));
lexer.addRule(new LR(/^[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, parseFloat));
lexer.addRule(new LR(/^"([^"]*)"/, 'STRING', 1));
lexer.addRule(new LR(/^[=!<>&\\|][=&\\|]+/), 'COP');
lexer.addRule(new LR(/^./), 'OP');

lexer.setSource(getter.getString('resources/parser/a.txt')); 
lexer.next();

var itself = () => this;

var literal = (val:any) -> {
  
}

var advance = (id:string) => {
  var token = lexer.rule().name;
  while (token === 'WS' || token === 'NL' || token === 'COMM') {
    token = lexer.next();
  }

  if (id && token !== id)
    throw new Error("Expected '" + id + "'.");

  if (token === 'INT' || token === 'FLOAT' || token === 'STRING') {
    return literal(lexer.value());
  }


}