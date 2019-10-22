import { InputState } from "./input";

export type InputHandler = (state: InputState) => boolean;

export function keyPress(key: string | number): InputHandler { return (state) => state.keysPress[key]; }
export function key(key: string | number): InputHandler { return (state) => state.keys[key]; }
export function mouseClick(button: number): InputHandler { return (state) => state.mouseClicks[button]; }
export function mouseButton(button: number): InputHandler { return (state) => state.mouseButtons[button]; }
export function combination(lh: InputHandler, rh: InputHandler): InputHandler { return (state) => lh(state) && rh(state) }
export const wheelUp: InputHandler = (state) => state.wheel > 0;
export const wheelDown: InputHandler = (state) => state.wheel < 0;

let keymap: { [index: string]: InputHandler } = {}
let absentConfigSet = new Set<string>();

export function action(name: string, state: InputState): boolean {
  let config = keymap[name];
  if (config == undefined) {
    if (!absentConfigSet.has(name)) {
      console.warn(`Unbound action ${name}`);
      absentConfigSet.add(name);
    }
    return false;
  }
  return config(state);
}

export function addActionHandler(name: string, handler: InputHandler): InputHandler {
  keymap[name] = handler;
  return handler;
}

function parseHandler(cmd: string) {
  if (cmd == 'wheel+') return wheelUp;
  if (cmd == 'wheel-') return wheelDown;
  if (cmd == 'mouse0') return mouseClick(0);
  if (cmd == 'mouse1') return mouseClick(1);
  if (cmd == 'mouse2') return mouseClick(2);
  if (cmd == '+mouse0') return mouseButton(0);
  if (cmd == '+mouse1') return mouseButton(1);
  if (cmd == '+mouse2') return mouseButton(2);
  if (cmd.startsWith('+')) return key(cmd.substr(1));
  if (cmd.indexOf('+') != -1) {
    let plus = cmd.indexOf('+');
    let mod = cmd.substring(0, plus);
    return combination(key(mod), parseHandler(cmd.substr(plus + 1)));
  }
  return keyPress(cmd);
}

export function addActionHandlerParse(name: string, cmd: string) {
  return addActionHandler(name, parseHandler(cmd));
}

export function loadKeymap(json: { [index: string]: string }) {
  for (let action in json) {
    let cmd = json[action];
    addActionHandlerParse(action, cmd);
  }
}