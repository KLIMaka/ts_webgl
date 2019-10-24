import { InputState, bind } from "./input";
import { warning } from "./logger";
import { Event, State } from "./engines/build/api";
import { Collection, Deck, EMPRTY_COLLECTION } from "./deck";

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
      warning(`Unbound action ${name}`);
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

function parseMod(str: string): InputHandler {
  if (str == 'mouse0') return mouseButton(0);
  if (str == 'mouse1') return mouseButton(1);
  if (str == 'mouse2') return mouseButton(2);
  return key(str.toUpperCase());
}

function parseKey(str: string): InputHandler {
  if (str == 'wheelup') return wheelUp;
  if (str == 'wheeldown') return wheelDown;
  if (str == 'mouse0') return mouseClick(0);
  if (str == 'mouse1') return mouseClick(1);
  if (str == 'mouse2') return mouseClick(2);
  return keyPress(str.toUpperCase());
}

function canonizeBind(key: string, mods: string[]) {
  key = key.toLowerCase();
  mods = mods.map((s) => s.toLowerCase());
  mods.sort();
  return [...mods, key].join('+');
}

function createHandler(key: string, mods: string[]): InputHandler {
  let handler = parseKey(key);
  for (let i = 0; i < mods.length; i++) handler = combination(handler, parseMod(mods[i]));
  return handler;
}


export class Binder {
  private binds: string[] = [];
  private handlers: InputHandler[] = [];
  private events: Deck<Event>[] = [];
  private sorttable: number[] = [];

  private stateBinds: string[] = [];
  private stateHandlers: InputHandler[] = [];
  private stateValues: [string, any, any][][] = [];

  public poolEvents(state: InputState): Collection<Event> {
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      if (this.handlers[i](state))
        return this.events[i];
    }
    return EMPRTY_COLLECTION;
  }

  public updateState(input: InputState, state: State) {
    for (let i = 0; i < this.stateHandlers.length; i++) {
      for (let value of this.stateValues[i]) {
        state.set(value[0], this.stateHandlers[i](input) ? value[1] : value[2]);
      }
    }
  }

  public addStateBind(name: string, enabled: any, disabled: any, ...keys: string[]) {
    let last = keys.pop();
    let bindName = canonizeBind(last, keys);
    let idx = this.stateBinds.indexOf(bindName);
    if (idx == -1) {
      this.stateBinds.push(bindName);
      let handler = parseMod(last);
      for (let i = 0; i < keys.length; i++) handler = combination(handler, parseMod(keys[i]));
      this.stateHandlers.push(handler);
      this.stateValues.push([[name, enabled, disabled]]);
    } else {
      this.stateValues[idx].push([name, enabled, disabled]);
    }
  }

  public addBind(event: Event, key: string, ...mods: string[]) {
    let bindName = canonizeBind(key, mods);
    let bindIdx = this.findBind(bindName, mods.length);
    if (bindIdx == -1) {
      let handler = createHandler(key, mods);
      this.insertBind(bindName, handler, event, mods.length);
    } else {
      this.events[bindIdx].push(event);
    }
  }


  private insertBind(bindName: string, handler: InputHandler, event: Event, mods: number): void {
    this.ensureSortTable(mods);
    let pos = this.sorttable[mods];
    this.binds.splice(pos, 0, bindName);
    this.handlers.splice(pos, 0, handler);
    this.events.splice(pos, 0, new Deck().push(event));
    for (let i = this.sorttable.length - 1; i >= mods; i--) {
      this.sorttable[i]++;
    }
  }

  private findBind(bindName: string, mods: number) {
    this.ensureSortTable(mods);
    let start = mods == 0 ? 0 : this.sorttable[mods - 1]
    for (let i = start; i < this.sorttable[mods]; i++) {
      if (this.binds[i] == bindName) return i;
    }
    return -1;
  }

  private ensureSortTable(mods: number) {
    for (let i = mods; i >= 0; i--)
      if (this.sorttable[i] == undefined)
        this.sorttable[i] = this.binds.length;
      else break;
  }
}

export class StringEvent implements Event {
  constructor(readonly name: String) { }
}

export function loadBinds(binds: string, binder: Binder) {
  let lines = binds.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim().toLowerCase();
    if (line.length == 0) continue;
    let idx = line.indexOf(' ');
    if (idx == -1) {
      warning(`Skipping bind line: ${line}`);
      continue;
    }
    let keys = line.substr(0, idx);
    if (keys.startsWith('+')) {
      keys = keys.substr(1);
      let keyParts = keys.split('+');
      binder.addStateBind(line.substr(idx + 1).trim(), true, false, ...keyParts);
    } else {
      let event = new StringEvent(line.substr(idx + 1).trim());
      let keyParts = keys.split('+');
      let key = keyParts[keyParts.length - 1];
      keyParts.pop();
      binder.addBind(event, key, ...keyParts);
    }
  }
}
