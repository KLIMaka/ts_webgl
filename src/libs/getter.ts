let cache = {};

export function preload(fname: string, callback: (b: ArrayBuffer) => void, progressCallback: (percent: number) => void = null): void {
  let file = cache[fname];
  if (file != undefined) {
    callback(file);
    return;
  }
  let xhr = new XMLHttpRequest();
  xhr.onload = () => { cache[fname] = xhr.response; callback(xhr.response); }
  if (progressCallback)
    xhr.onprogress = (evt) => { progressCallback(evt.loaded / evt.total); }
  xhr.open('GET', fname, true);
  xhr.responseType = 'arraybuffer';
  xhr.send();
}

export function preloadString(fname: string, callback: (s: string) => void): void {
  let file = cache[fname];
  if (file != undefined) {
    callback(file);
    return;
  }
  let xhr = new XMLHttpRequest();
  xhr.responseType = "text"
  xhr.onload = () => { cache[fname] = xhr.response; callback(xhr.response); }
  xhr.open('GET', fname, true);
  xhr.send();
}
