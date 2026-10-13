export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      component: this.component,
      message,
      ...(meta ? { meta } : {}),
    };
    if (level === "ERROR") {
      console.error(JSON.stringify(entry));
    } else if (level === "WARN") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(msg: string, meta?: Record<string, any>) {
    this.log("DEBUG", msg, meta);
  }

  info(msg: string, meta?: Record<string, any>) {
    this.log("INFO", msg, meta);
  }

  warn(msg: string, meta?: Record<string, any>) {
    this.log("WARN", msg, meta);
  }

  error(msg: string, meta?: Record<string, any>) {
    this.log("ERROR", msg, meta);
  }
}
