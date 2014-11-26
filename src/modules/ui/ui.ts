

export class Element {
  constructor(private element:HTMLElement) {}

  public className(name:string):Element {
    this.element.className=name; 
    return this;
  }

  public text(text:string):Element {
    this.element.textContent = text;
    return this;
  }

  public append(element:Element):Element {
    this.element.appendChild(element.element);
    return this;
  }

  public pos(x:string, y:string):Element {
    this.element.style.left = x;
    this.element.style.top = y;
    return this;
  }

  public size(w:string, h:string):Element {
    this.element.style.width = w;
    this.element.style.height = h;
    return this;
  }

  public width(w:string):Element {
    this.element.style.width = w;
    return this;
  }

  public height(h:string):Element {
    this.element.style.height = h;
    return this;
  }

  public elem():HTMLElement {
    return this.element;
  }
}

function create(tag:string) {
  return document.createElement(tag);
}

export class Table extends Element {
  constructor() {
    super(create('table'));
  }

  public row(cols:Element[]):Table {
    var tr = new Element(create('tr'));
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var td = new Element(create('td')).append(c);
      tr.append(td);
    }
    this.append(tr);
    return this;
  }
}

export declare module Object {
  export function keys(obj:any):any;
  export function observe(beingObserved: any, callback: (update: any) => any):void;
}

export class Properties extends Table {
  constructor(props:any) {
    super();
    this.className('props');
    var keys = Object.keys(props);
    var labels = {};
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      var l = label(props[k]);
      labels[k] = l;
      this.prop(k, l);
    }
    Object.observe(props, (changes) => {
      for (var i = 0; i < changes.length; i++) {
        var c = changes[i];
        labels[c.name].text(props[c.name]+'');
      }
    });
  }

  public prop(name:string, el:Element):Properties {
    this.row([div('property_name').text(name), el]);
    return this;
  }
}

function div(className:string):Element {
  return new Element(create('div')).className(className);
}

export function table():Table {
  return new Table();
}

export function props(obj:any):Properties {
  return new Properties(obj);
}

export function label(text:string):Element {
  return div('label').text(text);
}

export function button(caption:string):Element {
  return div('contour').append(div('button').text(caption));
}

export function panel(title:string):Element {
  return div('frame')
    .append(div('header').text(title))
    .append(div('hline'))
    .append(div('content'));
}