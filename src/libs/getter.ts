
export function get(fname:string):ArrayBuffer {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', fname, false);
  xhr.responseType = 'arraybuffer';
  xhr.send();
  return xhr.response;
}

export function getString(fname:string):string {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', fname, false);
  xhr.send();
  return xhr.response;
}
