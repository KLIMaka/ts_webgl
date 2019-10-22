export const ERROR = 0;
export const WARN = 1;
export const INFO = 2;
export const TRACE = 3;

export type Appender = (level: number, ...message: any) => void;

let appenders: Array<Appender> = [];

function write(level: number, ...msg: any) {
  for (let i = 0; i < appenders.length; i++) {
    appenders[i](level, ...msg);
  }
}

export const error = (...msg: any) => write(ERROR, ...msg);
export const warning = (...msg: any) => write(WARN, ...msg);
export const info = (...msg: any) => write(INFO, ...msg);
export const trace = (...msg: any) => write(TRACE, ...msg);

export function addLogAppender(appender: Appender) {
  appenders.push(appender);
}

export const CONSOLE: Appender = (level: number, ...message: any) => {
  switch (level) {
    case ERROR: console.error(...message); return;
    case WARN: console.warn(...message); return;
    case INFO: console.info(...message); return;
    case TRACE: console.trace(...message); return;
  }
}