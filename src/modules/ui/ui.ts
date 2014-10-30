

export class Element {
  constructor(private elemrnt:HTMLElement) {}

  className(name:string): Element {this.element.className=name; return this}
  text(text:string): Element {this.element.textContent=text; return this}
  append(element:Element): Element {this.element.appendChild(element.element); return this}

}

function div(className:string):Element {
  return new Element(document.createElement('div')).className(className);
}


export function panel(title:string):Element {
  return div('frame1')
    .append(div('header').text(title))
    .append(div('hline'));
}