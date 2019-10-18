type ClockHandler = (clock: Clock) => void;

class EventTable {
  private table: ClockHandler[][] = null;
  private step: number = 0;

  constructor(private steps: number) {
    this.table = new Array<Array<ClockHandler>>(this.steps);
    for (let i = 0; i < this.steps; i++) {
      this.table[i] = new Array<ClockHandler>();
    }
  }

  public reset(): void {
    this.step = 0;
  }

  public next(): void {
    this.step = (this.step + 1) % this.steps;
  }

  public run(clock: Clock): void {
    let handlers = this.table[this.step];
    for (let i = 0; i < handlers.length; i++) {
      let h = handlers[i];
      h(clock);
    }
  }

  public addHandler(step: number, handler: ClockHandler): number {
    this.table[step].push(handler);
    return this.table[step].length;
  }

  public clear() {
    for (let i = 0; i < this.steps; i++) {
      this.table[i] = new Array<ClockHandler>();
    }
  }
}

class Clock {
  private bpm: number = 75;
  private scheduledBeat: number = -1;
  private nextBeatHandler: number;
  private eventTable: EventTable;
  private beatEventTable: EventTable[];
  private beatPage: number = 0;
  private subBeat = 0;

  constructor() {
    this.eventTable = new EventTable(32);
    this.beatEventTable = [new EventTable(32), new EventTable(32)];
  }

  public start(): void {
    if (this.scheduledBeat != -1)
      return;
    this.scheduledBeat = Date.now();
    this.beat();
  }

  private scheduleNextBeat(): void {
    let t = Date.now();
    let skipt = t - this.scheduledBeat;
    let timeout = (60 * 1000) / (this.bpm * 32) - skipt;
    this.nextBeatHandler = setTimeout(() => this.beat(), timeout);
    this.scheduledBeat = t + timeout;
  }

  private beat(): void {
    if (this.scheduledBeat == -1)
      return;
    this.eventTable.run(this);
    this.getCurrentBeatEventTable().run(this);
    this.eventTable.next();
    this.getCurrentBeatEventTable().next();
    this.subBeat = (this.subBeat + 1) % 32;
    if (this.subBeat == 0) {
      this.swapBeatEventTables();
    }
    this.scheduleNextBeat();
  }

  private getCurrentBeatEventTable(): EventTable {
    return this.beatEventTable[this.beatPage];
  }

  private getNextBeatEventTable(): EventTable {
    return this.beatEventTable[(this.beatPage + 1) % 2];
  }

  private swapBeatEventTables(): void {
    this.getNextBeatEventTable().clear();
    this.beatPage = (this.beatPage + 1) % 2;
  }

  public stop(): void {
    this.scheduledBeat = -1;
    clearTimeout(this.nextBeatHandler);
  }

  public addHandler(step: number, handler: ClockHandler): number {
    return this.eventTable.addHandler(step, handler);
  }

  public addBeatEvent(step: number, handler: ClockHandler): number {
    let s = this.subBeat + step + 1;
    if (s >= 32) {
      s -= 32;
      return this.getNextBeatEventTable().addHandler(s, handler);
    } else {
      return this.getCurrentBeatEventTable().addHandler(s, handler);
    }
  }
}


class Pattern {
  private slots: ClockHandler[];
  private slot: number = 0;

  constructor(private signature: number[], private beats: number) {
    this.slots = new Array<ClockHandler>(signature.length * beats);
  }

  public register(clock: Clock): void {
    for (let i = 0; i < this.signature.length; i++) {
      let off = this.signature[i];
      clock.addHandler(off, (c) => this.play(c));
    }
  }

  private play(clock: Clock): void {
    let action = this.slots[this.slot];
    this.slot = (this.slot + 1) % this.slots.length;
    if (action == null)
      return;
    action(clock);
  }

  public set(slot: number, h: ClockHandler): void {
    this.slots[slot] = h;
  }
}

function note(note: number, vel: number, len: number): ClockHandler {
  return (c) => {
    out.send([0x80, note, 0]);
    out.send([0x90, note, vel]);
    c.addBeatEvent(len, (c) => {
      out.send([0x80, note, 0]);
    })
  }
}

function chord(notes: number[], vel: number, len: number): ClockHandler {
  return (c) => {
    for (let i = 0; i < notes.length; i++) {
      out.send([0x80, notes[i], 0]);
      out.send([0x90, notes[i], vel]);
    }
    c.addBeatEvent(len, (c) => {
      for (let i = 0; i < notes.length; i++) {
        out.send([0x80, notes[i], 0]);
      }
    })
  }
}

let midi = null;
let out;
let pattern = null;
let clock = new Clock();

function onMIDISuccess(midiAccess: WebMidi.MIDIAccess) {
  console.log("MIDI ready!");
  midi = midiAccess;
  console.log(midi);
  out = midi.outputs.get('output-1');
  console.log('Connected MIDI: ' + out.name);

  // pattern = new Pattern([0, 8, 16, 24], 4);
  // pattern.register(clock);
  // clock.start();

  let outs = midiAccess.outputs;
  let inputs = midiAccess.inputs;
  for (let inp of inputs.keys()) {
    let i = inputs.get(inp);
    i.onmidimessage = (e: WebMidi.MIDIMessageEvent): void => {
      console.log(e.data);
      for (let out of outs.keys()) {
        if (inp == out) continue;
        let o = outs.get(out);
        o.send(e.data);
      }
    }
  }
}

function onMIDIFailure(msg) {
  console.log("Failed to get MIDI access - " + msg);
}

navigator['requestMIDIAccess']().then(onMIDISuccess, onMIDIFailure);


