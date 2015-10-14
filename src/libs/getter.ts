
var cache = {};


export class Loader {

  private callback:() => void;
  private toLoad = 0;

  public load(fname:string, progress:(p:number)=>void=null):Loader {
    var self = this;
    preload(fname, (b:ArrayBuffer)=>{cache[fname]=b; self.ready(fname)}, progress);
    this.toLoad++;
    return this;
  }

  public loadString(fname:string):Loader {
    var self = this;
    preloadString(fname, (s:string)=>{cache[fname]=s; self.ready(fname);});
    this.toLoad++;
    return this;
  }

  public finish(callback:() => void): void {
    this.callback = callback;
  }

  private ready(fname:string): void {
    this.toLoad--;
    if (this.toLoad == 0)
      this.callback();
  }
}

export var loader = new Loader();

export function get(fname:string):ArrayBuffer {
  return cache[fname];
}

export function getString(fname:string):string {
  return cache[fname];
}

export function preload(fname:string, callback:(b:ArrayBuffer)=>void, progressCallback:(percent:number)=>void=null):void {
  var file = cache[fname];
  if (file != undefined){
    callback(file);
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.onload = () => {callback(xhr.response);}
  if (progressCallback)
    xhr.onprogress = (evt) => {progressCallback(evt.loaded/evt.total);}
  xhr.open('GET', fname, true);
  xhr.responseType = 'arraybuffer';
  xhr.send();
}

export function preloadString(fname:string, callback:(s:string)=>void):void {
  var file = cache[fname];
  if (file != undefined){
    callback(file);
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.responseType = "text"
  xhr.onload = () => {callback(xhr.response);}
  xhr.open('GET', fname, true);
  xhr.send();
}
