import lex = require('./modules/lex/lexer');
import pars = require('./modules/lex/parser');
import getter = require('./libs/getter');
import AB = require('./libs/asyncbarrier');

class Scope {
  private symbols = {};

  constructor(private parent:Scope){}

  public add(name:string, value:any) {
    this.symbols[name] = value;
  }

  public get(name:string):any {
    var scope = <Scope> this;
    var smb = undefined;
    while (smb == undefined && scope != null) {
      smb = scope.symbols[name];
      scope = scope.parent;
    }
    return smb;
  }

  public pop():Scope {
    return this.parent;
  }

  public push():Scope {
    return new Scope(this);
  }
}

class LexStack {
  private off = 0;
  constructor(private src:string, private parent:LexStack) {
    lexer.setSource(src);
  }

  public push(src:string) {
    this.off = lexer.mark();
    return new LexStack(src, this);
  }

  public pop() {
    var parent = this.parent;
    lexer.setSource(parent.src);
    lexer.reset(parent.off);
    return parent;
  }
}

var LR = lex.LexerRule;
var lexer = new lex.Lexer();
lexer.addRule(new LR(/^[ \t\r\v\n]+/,                         'WS'));
lexer.addRule(new LR(/^\(/,                                   'LP'));
lexer.addRule(new LR(/^\)/,                                   'RP'));
lexer.addRule(new LR(/^'/,                                    'LST'));
lexer.addRule(new LR(/^[^ \t\r\v\n\(\)'"]+/,                  'ID'));
lexer.addRule(new LR(/^[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, parseFloat));
lexer.addRule(new LR(/^[0-9]+/,                               'INT', 0, parseInt));
lexer.addRule(new LR(/^"([^"]*)"/,                            'STRING', 1));

var scope = new Scope(null);
var lexStack:LexStack = null;
var RP = new Object();

scope.add('+', () => {
  var sum = 0;
  for (var e = evaluate(); e != RP; e = evaluate())
    sum += e;
  return sum;
});

scope.add('-', () => {
  var sum = evaluate();
  for (var e = evaluate(); e != RP; e = evaluate())
    sum -= e;
  return sum;
});

scope.add('set', () => {
  var id = evaluate();
  var val = evaluate();
  scope.add(id, val);
  evaluate(); // RP
  return val;
});

scope.add('lambda', () => {
  var fargs = [];
  for (var e = noneval(); e != RP; e = noneval())
    fargs.push(e);
  return () => {
    scope = scope.push();
    for (var e = evaluate(), i = 0; e != RP; e = evaluate(), i++) {
      scope.add(fargs[i], e);
    }
    lexStack = lexStack.push(fargs[i]);
    var result = evaluate();
    lexStack = lexStack.pop();
    scope = scope.pop();
    return result;
  }
});

scope.add('if', () => {
  var cond = evaluate();
  if (cond){
    var ret = evaluate();
    noneval();
    return ret;
  } else {
    noneval();
   return evaluate();
  }
})

function next() {
  var next = lexer.next();
  while(next == 'WS')
    next = lexer.next();
  return next;
}

function noneval() {
  var token = next();
  var value = lexer.value();
  
  if (token == 'LP') {
    var list = '( ';
    for (var e = noneval(); e != RP; e = noneval()) 
      list += e + ' ';
    list += ')';
    return list;
  }
  if (token == 'RP')
    return RP;
  return value;
}

function evaluate() {
  var token = next();
  var value = lexer.value();
  if ( token == 'FLOAT' || token == 'INT' || token == 'STRING') {
    return value;
  }

  if (token == 'LST') {
    return noneval();
  }

  if (token == 'ID') {
    var symbol = scope.get(value);
    if (symbol == undefined)
      return value;
    return symbol;
  }

  if (token == 'LP') {
    return call();
  }

  if (token == 'RP')
    return RP;

  throw new Error('Cannot eval ' + token + ':' + value);
}

function call() {
  var func = evaluate();
  return func();
}

var ab = AB.create();
getter.preloadString('resources/parser/lisp.lsp', ab.callback('src'));

ab.wait((res) => {

lexStack = new LexStack(res.src, null);
for(;;) {
  console.log(evaluate());
}

});



