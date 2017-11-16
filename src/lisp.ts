///<reference path='defs/node.d.ts' />

import fs = require('fs');
import lex = require('./modules/lex/lexer');

class Scope {
  private symbols = {};

  constructor(private parent:Scope, private closure:Scope){}

  public add(name:string, value:any) {
    if (this.closure != null && this.closure[name] != undefined) {
      this.closure[name] = value;
      return;
    }
    this.symbols[name] = value;
  }

  public get(name:string):any {
    var smb = this.closure==null||name=='_args' ? undefined : this.closure.get(name);
    if (smb != undefined)
      return smb;
    var scope = <Scope> this;
    while (smb == undefined && scope != null) {
      smb = scope.symbols[name];
      scope = scope.parent;
    }
    return smb;
  }

  public pop():Scope {
    return this.parent;
  }

  public push(closure:Scope):Scope {
    return new Scope(this, closure);
  }
}

class Value {
  constructor(public type, public value) {}
}

var types = {};

var Type = val(Type, 'Type'); Type.type = Type;
var Any = val(Type, 'Any');
var Number = val(Type, 'Number');
var String = val(Type, 'String');
var Symbol = val(Type, 'Symbol');
var List = val(Type, 'List');
var Lst = val(Type, 'LST');
var Placeholder = val(Type, 'Placeholder');
var Func = val(Type, 'Func');

function val(type, value):Value {
  return new Value(type, value);
}

function str(s:string) {
  return val(String, s);
}

var LST = val(LST, null);
var RP = val(')', null);
var LP = val('(', null);
var EOF = val('EOF', null);


function register(type, method, func) {
  var sig = type.value;
  var algebra = types[sig];
  if (algebra == undefined) {
    algebra = {};
    types[sig] = algebra;    
  }
  algebra[method] = func;
}

function call(func:string, value:Value) {
  var sig = value.type.value
  var algebra = types[sig];
  if (algebra == undefined) {
    algebra = types[Any.value];
  }
  var f = algebra[func];
  if (f == undefined) {
    f = types[Any.value][func];
  }
  if (f == undefined) {
    throw new Error('Function ' + func + ' is undefined for Type ' + value.type);
  }
  return f(value);
}

class LazyValue {
  private val;
  constructor(private form) {}
  public get() { if (this.val == null) this.val = evaluate(this.form); return this.val;}
}

class ArrayView {
  constructor(private arr:Object[], private start:number) {}
  public get(idx:number) { return this.arr[this.start + idx] }
  public head() { return this.arr[this.start] }
  public rest() { return this.length() == 1 ? EMPTY : createList(this.arr, this.start+1) }
  public length() { return this.arr.length - this.start }
}
var EMPTY = new ArrayView([], 0);

function createList(arr:Object[], start:number=0) {
  return val(List, arr.length == 0 ? EMPTY : new ArrayView(arr, start));
}

function cons(head, rest) {
  var arr = new Array<Object>(rest.length() + 1);
  arr[0] = head;
  for (var i = 0; i < rest.length(); i++){
    arr[i+1] = rest.get(i);
  }
  return createList(arr);
}

function getPlaceholder(arg:Value):number {
  if (arg.type == Placeholder)
    return arg.value;
  return -1;
}

function isCurried(args) {
  for (var i = 0; i < args.length(); i++) {
    var arg = args.get(i);
    if (getPlaceholder(arg) != -1) {
      return true;
    }
  }
  return false;
}

function curry(f, args) {
  args = args.value;
  if (isCurried(args)) {
    var evaluated = [];
    for (var i = 0; i < args.length(); i++) {
      var arg = args.get(i);
      if (getPlaceholder(arg) == -1) {
        evaluated[i] = evaluate(arg);
      }
    }
    return (l) => {
      var nargs = [];
      for (var i = 0; i < args.length(); i++) {
        var arg = args.get(i);
        var placeholderIdx = getPlaceholder(arg);
        if (placeholderIdx == -1) {
          nargs[i] = evaluated[i];
        } else {
          nargs[i] = l.get(placeholderIdx);
        }
      }
      return f(createList(nargs))
    } 
  } else {
    return f(args);
  }
}

var LR = lex.LexerRule;
var lexer = new lex.Lexer();
lexer.addRule(new LR(/^[ \t\r\v\n]+/,                            'WS'));
lexer.addRule(new LR(/^\(/,                                      'LP',     0, ()  => { return LP }));
lexer.addRule(new LR(/^\)/,                                      'RP',     0, ()  => { return RP }));
lexer.addRule(new LR(/^`/,                                       'LST',    0, ()  => { return LST }));
lexer.addRule(new LR(/^[^ \t\r\v\n\(\)`"]+/,                     'ID',     0, (s) => { return val(Symbol, s)}));
lexer.addRule(new LR(/^_([0-9])+/,                               'PLH',    1, (s) => { return val(Placeholder, parseInt(s)) }));
lexer.addRule(new LR(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT',  0, (s) => { return val(Number, parseFloat(s)) } ));
lexer.addRule(new LR(/^\-?[0-9]+/,                               'INT',    0, (s) => { return val(Number, parseInt(s)) }   ));
lexer.addRule(new LR(/^"([^"]*)"/,                               'STRING', 1, (s) => { return val(String, s) }             ));

var scope = new Scope(null, null);

scope.add('set', val(Func, (list) => {
  var id = list.get(0).value;
  var val = evaluate(list.get(1));
  scope.add(id, val);
  return val;
}));

scope.add('type', val(Func, (v) => {
  return evaluate(v.get(0)).type;
}));

register(List, 'evaluate', (l:Value) => {
  var head = l.value.head();
  if (head === LST)
    return l.value.get(1);

  var func = call('evaluate', head);
  if (func.type != Func) {
    throw new Error(print(func) + ' not a function');
  }
  return curry(func.value, l.value.rest());
});
register(Symbol, 'evaluate', (s:Value) => {
  var symbol = scope.get(s.value);
  if (symbol == undefined)
    return s;
  return symbol;
});
register(Any, 'evaluate', (a:Value) => { return a });

function evaluate(v:Value) {
  return call('evaluate', v);
}

register(List, 'head', (l:Value) => { return l.value.head() });
register(String, 'head', (l:Value) => { return l.value.substr(0, 1) });

scope.add('if', (l) => { if (evaluate(l.get(0))) return evaluate(l.get(1)); else return evaluate(l.get(2));});
scope.add('head', (l) => { return call('head', evaluate(l.head()));});
scope.add('rest', (l) => { return call('rest', evaluate(l.head()));});
scope.add('length', (l) => { return call('length', evaluate(l.head()));});
scope.add('cons', (l) => { return cons(evaluate(l.head()), evaluate(l.get(1)));});
scope.add('list?', (l) => { return evaluate(l.head()) instanceof ArrayView });
scope.add('LST', LST);

scope.add('list', (list) => {
  var lst = [];
  for (var i = 0; i < list.length(); i++) {
    var val = evaluate(list.get(i));
    lst.push(val);
  }
  return createList(lst);
});

function append(list):any {
  var lst = [];
  for (var i = 0; i < list.length(); i++) {
    var l = evaluate(list.get(i));
    for (var j = 0; j < l.length(); j++) {
      lst.push(l.get(j));
    }
  }
  return createList(lst);
}
scope.add('append', (list) => {
  return append(list);
});

scope.add('print', (list) => {
  var val = null;
  for (var i = 0; i < list.length(); i++){
    val = evaluate(list.get(i));
    console.log(print(val));
  }
  return val;
});


scope.add('lambda', (formals) => {
  var closure = scope;
  return (list) => {
    var nscope = scope.push(null);
    var facts = [];
    for (var i = 0; i < list.length(); i++) {
      var fact = evaluate(list.get(i));
      facts.push(fact);
      if (formals.length() - 1 > i) {
        nscope.add(formals.get(i), fact);
      }
    }
    nscope.add('_args', createList(facts));
    scope = nscope.push(closure);
    var result = evaluate(formals.get(formals.length()-1));
    scope = scope.pop();
    scope = scope.pop();
    return result;
  }
});

scope.add('eval', (l) => {
  return evaluate(evaluate(l.head()));
});

scope.add('evaljs', (l) => {
  var f = Function("l", "evaluate", "str", l.head().str);
  return (l) => {return f(l, evaluate, str)};
});

scope.add('seq', (list) => {
  var res = null;
  for (var i = 0; i < list.length(); i++) {
    res = evaluate(list.get(i));
  }
  return res;
});

scope.add('let', (l) => {
  var len = l.length();
  var i = 0;
  scope = scope.push(null);
  while (i < len-1) {
    var name = l.get(i++);
    var value = new LazyValue(l.get(i++));
    scope.add(name, value);
  }
  var ret = evaluate(l.get(len-1));
  scope = scope.pop();
  return ret;
});

function print(val:Value):string {
  switch (val.type) {
    case List:
      var str = '( ';
      for (var i = 0; i < val.value.length(); i++) {
        str += print(val.value.get(i)) + ' ';
      }
      return str + ')';    
    case Func:
      return "[Function]";
    case String:
      return "'" + val.value + "'";
    default:
      return val.value + '' ;
  }
}

function next() {
  var next = lexer.next();
  while(next == 'WS')
    next = lexer.next();
  return next;
}

function parse(): any {
  var token = next();
  var value = lexer.value();
  
  if (value === LST) {
    return createList([LST, parse()]);
  }

  if (value == LP) {
    var lst = [];
    for (var e = parse(); e != RP; e = parse()) {
      if (e == EOF)
        throw new Error('Unbalanced parentesis')
      lst.push(e);
    }
    return createList(lst);
  }
  if (token == null)
    return EOF;
  return value;
}

var file = fs.readFileSync('../resources/parser/lisp.lsp', {encoding:'UTF-8'});
lexer.setSource(file);
for(;;) {
  var value = parse();
  if (value === EOF)
    break;
  console.log(print(evaluate(value)));
}


