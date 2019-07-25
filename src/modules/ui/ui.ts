

export class Element {
  constructor(private element: HTMLElement) { }

  public className(name: string): Element {
    this.element.className = name;
    return this;
  }

  public text(text: string): Element {
    this.element.textContent = text;
    return this;
  }

  public append(element: Element): Element {
    this.element.appendChild(element.element);
    return this;
  }

  public pos(x: string, y: string): Element {
    this.element.style.left = x;
    this.element.style.top = y;
    return this;
  }

  public size(w: string, h: string): Element {
    this.element.style.width = w;
    this.element.style.height = h;
    return this;
  }

  public width(w: string): Element {
    this.element.style.width = w;
    return this;
  }

  public height(h: string): Element {
    this.element.style.height = h;
    return this;
  }

  public elem(): HTMLElement {
    return this.element;
  }

  public attr(name: string, val: any): Element {
    this.element.setAttribute(name, val);
    return this;
  }

  public css(name: string, val: any): Element {
    this.element.style[name] = val;
    return this;
  }
}

function create(tag: string) {
  return document.createElement(tag);
}

export class Table extends Element {
  constructor() {
    super(create('table'));
  }

  public row(cols: Element[]): Table {
    let tr = new Element(create('tr'));
    for (let i = 0; i < cols.length; i++) {
      let c = cols[i];
      let td = new Element(create('td')).append(c);
      tr.append(td);
    }
    this.append(tr);
    return this;
  }

  public removeRow(row: number): Table {
    (<HTMLTableElement>this.elem()).deleteRow(row);
    return this;
  }
}

export declare module Object {
  export function keys(obj: any): any;
}

export class Properties extends Table {
  private labels: any = {};

  constructor() {
    super();
    this.className('props');
  }

  public prop(name: string, el: Element): Properties {
    this.row([div('property_name').text(name), el]);
    return this;
  }

  public refresh(props: any): Properties {
    let fields = Object.keys(props);
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      let l = this.labels[field];
      if (l == undefined) {
        l = label('');
        this.labels[field] = l;
        this.prop(field, l);
      }
      l.text(props[field] + '');
    }
    return this;
  }
}

export function tag(tag: string): Element {
  return new Element(create(tag));
}

export function div(className: string): Element {
  return new Element(create('div')).className(className);
}

export function table(): Table {
  return new Table();
}

export function props(): Properties {
  return new Properties();
}

export function label(text: string): Element {
  return div('label').text(text);
}

export function button(caption: string): Element {
  return div('contour').append(div('button').text(caption));
}

export function panel(title: string): Element {
  return div('frame')
    .append(div('header').text(title))
    .append(div('hline'))
    .append(div('content'));
}

export class Progress extends Element {
  private title: Element;
  private progress: Element;

  constructor(title: string, max: number = 100) {
    super(create('div'));
    this.title = div('title').text(title);
    this.progress = new Element(create('progress')).attr('max', max);
    this.append(this.title).append(this.progress);
  }

  public max(max: number): Progress {
    this.progress.attr('max', max);
    return this;
  }

  public setValue(val: number): Progress {
    this.progress.attr('value', val);
    return this;
  }
}

export function progress(title: string, max: number = 100) {
  return new Progress(title, max);
}

export class VerticalPanel extends Element {
  private rows = 0;
  constructor(className: string) {
    super(create('div'));
    this.className(className);
  }

  public add(elem: Element): number {
    this.append(elem);
    return this.rows++;
  }
}

export function verticalPanel(className: string): VerticalPanel {
  return new VerticalPanel(className);
}

