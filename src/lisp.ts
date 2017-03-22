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
    var smb = this.closure==null ? undefined : this.closure.get(name);
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

class LazyValue {
  private val;
  constructor(private form) {}

  public get() {
    if (this.val == null) {
      this.val = evaluate(this.form);
    }
    return this.val;
  }
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
  return arr.length == 0 ? EMPTY : new ArrayView(arr, start);
}

class Placeholder {
  constructor(public idx:number) {}
}

class System {
  constructor(private name:string) {}
}

function cons(head, rest) {
  var arr = new Array<Object>(rest.length() + 1);
  arr[0] = head;
  for (var i = 0; i < rest.length(); i++){
    arr[i+1] = rest.get(i);
  }
  return createList(arr);
}

function getPlaceholder(arg):number {
  if (arg instanceof Placeholder)
    return (<Placeholder>arg).idx;
  return -1;
}

function curry(f, args) {
  var curried = false;
  for (var i = 0; i < args.length(); i++) {
    var arg = args.get(i);
    if (getPlaceholder(arg) != -1) {
      curried = true;
      break;
    }
  }

  if (curried) {
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

var LST = new System('LST');
function lst() {return LST}
function placeholder(idx)  { return new Placeholder(parseInt(idx)) };
var LR = lex.LexerRule;
var lexer = new lex.Lexer();
lexer.addRule(new LR(/^[ \t\r\v\n]+/,                            'WS'));
lexer.addRule(new LR(/^\(/,                                      'LP'));
lexer.addRule(new LR(/^\)/,                                      'RP'));
lexer.addRule(new LR(/^`/,                                       'LST', 0, lst));
lexer.addRule(new LR(/^[^ \t\r\v\n\(\)`"]+/,                     'ID'));
lexer.addRule(new LR(/^_([0-9])+/,                               'PLH', 1, placeholder));
lexer.addRule(new LR(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, parseFloat));
lexer.addRule(new LR(/^\-?[0-9]+/,                               'INT', 0, parseInt));
lexer.addRule(new LR(/^"([^"]*)"/,                               'STRING', 1));

var scope = new Scope(null, null);
var RP = new System('RP');
var EOF = new System('EOF');

scope.add('+', (list) => {
  var sum = 0
  for (var i = 0; i < list.length(); i++)
    sum += evaluate(list.get(i));
  return sum;
});

scope.add('*', (list) => {
  var mul = 1
  for (var i = 0; i < list.length(); i++)
    mul *= evaluate(list.get(i));
  return mul;
});

scope.add('set', (list) => {
  var id = evaluate(list.get(0));
  var val = evaluate(list.get(1));
  scope.add(id, val);
  return val;
});

scope.add('if', (l) => { if (evaluate(l.get(0))) return evaluate(l.get(1)); else return evaluate(l.get(2));});
scope.add('>', (l) => { return evaluate(l.get(0)) > evaluate(l.get(1));});
scope.add('<', (l) => { return evaluate(l.get(0)) < evaluate(l.get(1));});
scope.add('<=', (l) => { return evaluate(l.get(0)) <= evaluate(l.get(1));});
scope.add('>=', (l) => { return evaluate(l.get(0)) >= evaluate(l.get(1));});
scope.add('!=', (l) => { return evaluate(l.get(0)) != evaluate(l.get(1));});
scope.add('==', (l) => { return evaluate(l.head()) == evaluate(l.get(1));});
scope.add('head', (l) => { return evaluate(l.head()).head();});
scope.add('rest', (l) => { return evaluate(l.head()).rest();});
scope.add('length', (l) => { return evaluate(l.head()).length();});
scope.add('cons', (l) => { return cons(evaluate(l.head()), evaluate(l.get(1)));});

scope.add('list', (list) => {
  var lst = [];
  for (var i = 0; i < list.length(); i++) {
    var val = evaluate(list.get(i));
    lst.push(val);
  }
  return createList(lst);
});


scope.add('append', (list) => {
  var lst = [];
  for (var i = 0; i < list.length(); i++) {
    var l = evaluate(list.get(i));
    for (var j = 0; j < l.length(); j++) {
      lst.push(l.get(j));
    }
  }
  return createList(lst);
});

scope.add('print', (list) => {
  var val = null;
  for (var i = 0; i < list.length(); i++){
    val = evaluate(list.get(i));
    console.log(val);
  }
  return val;
});


scope.add('lambda', (formals) => {
  var closure = scope;
  return (list) => {
    scope = scope.push(null);
    for (var i = 0; i < list.length(); i++) {
      scope.add(formals.get(i), evaluate(list.get(i)));
    }
    scope = scope.push(closure);
    var result = evaluate(formals.get(i));
    scope = scope.pop();
    scope = scope.pop();
    return result;
  }
});

scope.add('eval', (l) => {
  return evaluate(evaluate(l.head()));
});

scope.add('evaljs', (l) => {
  var f = Function("l", "evaluate", l.head());
  return (l) => {return f(l, evaluate)};
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


function next() {
  var next = lexer.next();
  while(next == 'WS')
    next = lexer.next();
  return next;
}

function parse(): any {
  var token = next();
  var value = lexer.value();
  
  if (token == 'LST') {
    return createList([LST, parse()]);
  }

  if (token == 'LP') {
    var lst = [];
    for (var e = parse(); e != RP; e = parse()) {
      if (e == EOF)
        throw new Error('Unbalanced parentesis')
      lst.push(e);
    }
    return createList(lst);
  }
  if (token == 'RP')
    return RP;
  if (token == null)
    return EOF;
  return value;
}

function evaluate(form) {
  if (form instanceof ArrayView) {
    var head = form.head();

    if (head === LST)
      return form.get(1);

    var func = evaluate(head);
    if (!(func instanceof Function)){
      console.error(func);
      throw new Error(func + ' not a function');
    }
    return curry(func, form.rest());
  }

  var symbol = scope.get(form);
  if (symbol == undefined)
    return form;
  return symbol instanceof LazyValue ? symbol.get() : symbol;
}

var file = fs.readFileSync('../resources/parser/lisp.lsp', {encoding:'UTF-8'});
lexer.setSource(file);
for(;;) {
  var value = parse();
  if (value === EOF)
    break;
  console.log(evaluate(value));
}


