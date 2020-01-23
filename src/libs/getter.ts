const cache: { [index: string]: any } = {};
const xhrCache: { [index: string]: XMLHttpRequest } = {}
const cacheString: { [index: string]: any } = {};
const xhrCacheString: { [index: string]: XMLHttpRequest } = {}

function getRequest(fname: string, type: XMLHttpRequestResponseType, cache: { [index: string]: XMLHttpRequest }) {
  let xhr = cache[fname];
  if (xhr == undefined) {
    xhr = new XMLHttpRequest();
    xhr.responseType = type;
    xhr.addEventListener('load', () => delete cache[fname]);
    xhr.open('GET', fname, true);
    xhr.send();
    cache[fname] = xhr;
  }
  return xhr;
}

export function preload(fname: string, callback: (b: ArrayBuffer) => void, progressCallback: (percent: number) => void = () => { }): void {
  const file = cache[fname];
  if (file != undefined) {
    callback(file);
    return;
  }
  const xhr = getRequest(fname, 'arraybuffer', xhrCache);
  xhr.addEventListener('load', () => { cache[fname] = xhr.response; callback(xhr.response) });
  xhr.addEventListener('progress', (evt) => { progressCallback(evt.loaded / evt.total); });
}

export function preloadString(fname: string, callback: (s: string) => void): void {
  const file = cacheString[fname];
  if (file != undefined) {
    callback(file);
    return;
  }
  const xhr = getRequest(fname, 'text', xhrCacheString);
  xhr.addEventListener('load', () => { cacheString[fname] = xhr.response; callback(xhr.response); });
}
