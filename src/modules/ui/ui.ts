

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

function div(className:string):Element {
  return new Element(document.createElement('div')).className(className);
}

export function button(caption:string):Element {
  return div('contour').append(div('button').text(caption));
}

export function panel(title:string):Element {
  return div('frame')
    .append(div('header').text(title))
    .append(div('hline'))
    .append(div('content'))
    .append(div('hline'))
    .append(div('footer').append(
      div('center')
      .append(button('Ok'))
      .append(button('Cancel'))
      )
    );
}