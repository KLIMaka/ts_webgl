
function now() {
  return window.performance.now();
}

export class Section {
	constructor(
    public parent:Section, 
    public name:string,
    public startTime:number = now(),
    public time:number = 0,
    public subSections = {},
    public counts = {}) {
    if (parent != null)
      parent.subSections[name] = this;
  }

  public start() {
    if (this.startTime == -1)
      this.startTime = now();
  }

  public stop() {
    if (this.startTime != -1) {
      this.time = now() - this.startTime;
      this.startTime = -1;
    }
    return this.time;
  }

  public pause() {
    if (this.startTime != -1) {
      this.time += now() - this.startTime;
      this.startTime = -1;
    }
    return this.time;
  }

  public currentTime() {
    return this.startTime == -1 ? this.time : now() - this.startTime;
  }

  public createSubsection(name:string):Section {
    return new Section(this, name);
  }

  public inc(name:string) {
    var count = this.counts[name];
    this.counts[name] = (count == undefined ? 0 : count) + 1;
  }
}

var mainSection = new Section(null, 'Main');
var currentSection:Section = mainSection;

export function startProfile(name:string) {
  currentSection = new Section(currentSection, name);
}

export function incCount(name:string) {
  currentSection.inc(name);
}

export function endProfile() {
  var time = currentSection.stop();
  if (currentSection != mainSection)
    currentSection = currentSection.parent;
  return time;
}

export function start() {
  mainSection = new Section(null, 'Main');
  currentSection = mainSection;
}

export function get():Section {
  return mainSection;
}