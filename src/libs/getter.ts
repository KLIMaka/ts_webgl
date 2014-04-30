
var cache = {};

export class Loader {

  private callback:() => void;
  private toLoad = 0;

  public load(fname:string):Loader {
    preload(fname);
    this.toLoad++;
    return this;
  }

  public loadString(fname:string):Loader {
    preloadString(fname);
    this.toLoad++;
    return this;
  }

  public finish(callback:() => void): void {
    this.callback = callback;
  }

  public ready(fname:string): void {
    this.toLoad--;
    if (this.toLoad == 0)
      this.callback();
  }
}

export var loader = new Loader();

export function preload(fname:string):ArrayBuffer {
  var xhr = new XMLHttpRequest();
  xhr.onload = () => {cache[fname] = xhr.response; loader.ready(fname);}
  xhr.open('GET', fname, true);
  xhr.responseType = 'arraybuffer';
  xhr.send();
  return xhr.response;
}

export function get(fname:string):ArrayBuffer {
  return cache[fname];
}

export function getString(fname:string):string {
  return cache[fname];
}

export function preloadString(fname:string):string {
  var xhr = new XMLHttpRequest();
  xhr.onload = () => {cache[fname] = xhr.response; loader.ready(fname);}
  xhr.open('GET', fname, true);
  xhr.send();
  return xhr.response;
}
