import { table, label, Element, div } from "./modules/ui/ui";


function onMIDISuccess(midiAccess: WebMidi.MIDIAccess) {
  createChannelsTable(midiAccess);

  let outs = midiAccess.outputs;
  let inputs = midiAccess.inputs;
  for (let inp of inputs.keys()) {
    let i = inputs.get(inp);
    i.onmidimessage = (e: WebMidi.MIDIMessageEvent): void => {
      activeChannel(inp, e.data);
      for (let out of outs.keys()) {
        if (inputs.get(inp).name == outs.get(out).name) continue;
        let o = outs.get(out);
        activeChannel(out, e.data);
        o.send(e.data, e.timeStamp);
      }
    }
  }
}

function onMIDIFailure(reason: any) {
  // document.writeln("Failed to get MIDI access - " + reason);
}

let indicatorsMap: { [index: string]: Element } = {};

function activeChannel(device: string, data: Uint8Array) {
  let channel = data[0] & 0xf;
  let ind = indicatorsMap[`${device}_${channel}`];
  ind.css('background', 'green');
  setTimeout(() => { ind.css('background', 'gray'); }, 100);
}

function createHeaderChannelRow() {
  let columns: Element[] = [];
  columns.push(label('Name'));
  for (let i = 0; i < 16; i++) {
    let header = label('' + (i + 1));
    columns.push(header);
  }
  return columns;
}

function createChannelRow(name: string, id: string) {
  let columns: Element[] = [];
  columns.push(label(name));
  for (let i = 0; i < 16; i++) {
    let indicator = div('indicator');
    let indicatorId = `${id}_${i}`;
    indicatorsMap[indicatorId] = indicator;
    indicator.attr('id', id);
    indicator.size('10px', '10px');
    indicator.css('background', 'gray');
    columns.push(indicator);
  }
  return columns;
}

function createChannelsTable(midiAccess: WebMidi.MIDIAccess) {
  let outs = midiAccess.outputs;
  let inputs = midiAccess.inputs;

  let inputTable = table();
  inputTable.row(createHeaderChannelRow());
  for (let inp of inputs.keys()) {
    let input = inputs.get(inp);
    inputTable.row(createChannelRow(input.name, inp));
  }
  document.body.appendChild(inputTable.elem());

  let outputTable = table();
  outputTable.row(createHeaderChannelRow());
  for (let out of outs.keys()) {
    let output = outs.get(out);
    outputTable.row(createChannelRow(output.name, out));
  }
  document.body.appendChild(outputTable.elem());
}

navigator['requestMIDIAccess']().then(onMIDISuccess, onMIDIFailure);