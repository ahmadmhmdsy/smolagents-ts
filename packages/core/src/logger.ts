export interface Logger {
  debug(message: string, ...args: readonly unknown[]): void;
  info(message: string, ...args: readonly unknown[]): void;
  warn(message: string, ...args: readonly unknown[]): void;
  error(message: string, ...args: readonly unknown[]): void;
}

/** The default logger. Silent, so the library is quiet unless asked not to be. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** A logger that forwards to a console-like sink. Accepts the global console. */
export function consoleLogger(sink: Pick<Console, "debug" | "info" | "warn" | "error"> = console): Logger {
  return {
    debug: (message, ...args) => sink.debug(message, ...args),
    info: (message, ...args) => sink.info(message, ...args),
    warn: (message, ...args) => sink.warn(message, ...args),
    error: (message, ...args) => sink.error(message, ...args),
  };
}
