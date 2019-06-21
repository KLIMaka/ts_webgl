
var named = {
  8: 'BACKSPACE',
  9: 'TAB',
  13: 'ENTER',
  16: 'SHIFT',
  27: 'ESCAPE',
  32: 'SPACE',
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN'
};

function mapKeyCode(code: number): string {
  return named[code] || (code >= 65 && code <= 90 ? String.fromCharCode(code) : null);
}

export var keys: { [index: string]: boolean } = {};
export var mouseButtons = [false, false, false];
export var mouseClicks = [false, false, false];
export var mouseX = 0;
export var mouseY = 0;
export var wheel = 0;

export function postFrame() {
  wheel = 0;
  mouseClicks[0] = false;
  mouseClicks[1] = false;
  mouseClicks[2] = false;
}

export function bind() {
  document.addEventListener('mousemove', (e: MouseEvent) => mousemove(e));
  document.addEventListener('mouseup', (e: MouseEvent) => mouseup(e));
  document.addEventListener('mousedown', (e: MouseEvent) => mousedown(e));
  document.addEventListener('wheel', (e: WheelEvent) => wheelevent(e));
  document.addEventListener('keyup', (e: KeyboardEvent) => keyup(e));
  document.addEventListener('keydown', (e: KeyboardEvent) => keydown(e));
}

function updateState(e: KeyboardEvent, state: boolean) {
  keys['ALT'] = e.altKey;
  keys['SHIFT'] = e.shiftKey;
  keys['CTRL'] = e.ctrlKey;
  var key = mapKeyCode(e.keyCode);
  if (key) keys[key] = state;
  keys[e.keyCode] = state;
}

function keydown(e: KeyboardEvent) {
  updateState(e, true);
  return false;
}

function keyup(e: KeyboardEvent) {
  updateState(e, false);
  return false;
}

function mousemove(e: MouseEvent): boolean {
  mouseX = e.clientX;
  mouseY = e.clientY;
  return false;
}

function mouseup(e: MouseEvent): boolean {
  mouseButtons[e.button] = false;
  mouseClicks[e.button] = true;
  return false;
}

function mousedown(e: MouseEvent): boolean {
  mouseButtons[e.button] = true;
  return false;
}

function wheelevent(e: WheelEvent): boolean {
  wheel = e.deltaY > 0 ? 1 : -1;
  return false;
}
