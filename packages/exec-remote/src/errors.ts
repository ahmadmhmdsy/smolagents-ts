/**
 * Typed refusals. Nothing here imports a Node builtin, so the root entry can carry them.
 */

/** A backend subpath was imported but its optional peer client is not installed. */
export class MissingPeerDependencyError extends Error {
  readonly peer: string;
  readonly entry: string;

  constructor(peer: string, entry: string) {
    super(
      'The optional peer dependency "' +
        peer +
        '" is required by "' +
        entry +
        '"; install it to use that backend, or import the root entry instead.',
    );
    this.name = "MissingPeerDependencyError";
    this.peer = peer;
    this.entry = entry;
  }
}

/** The guest called a tool on a backend that has no mid-run call channel. */
export class ToolRoundTripUnsupportedError extends Error {
  readonly tool: string;
  readonly backend: string;

  constructor(tool: string, backend: string) {
    super(
      'The ' +
        backend +
        ' backend runs code in one shot and has no mid-run call channel, so the guest cannot call the tool "' +
        tool +
        '"; only final_answer() is available.',
    );
    this.name = "ToolRoundTripUnsupportedError";
    this.tool = tool;
    this.backend = backend;
  }
}

/** A `pickle:` payload arrived and `allowPickle` is not true. */
export class PickleRefusedError extends Error {
  constructor(
    message = "Refusing a pickle: payload: the host never executes pickle opcodes. Pass allowPickle: true to carry the raw bytes through instead.",
  ) {
    super(message);
    this.name = "PickleRefusedError";
  }
}

/** A value cannot be represented on the host-owned value wire. */
export class SerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SerializationError";
  }
}

/** A backend lifecycle call was made out of order, or a child died outside a step. */
export class SandboxError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "SandboxError";
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** A backend was asked for an egress policy it cannot enforce. */
export class EgressUnsupportedError extends Error {
  readonly backend: string;
  readonly egress: string;

  constructor(backend: string, egress: string) {
    super(
      'The ' +
        backend +
        ' backend cannot enforce the egress policy "' +
        egress +
        '": it offers no confinement to apply, so it would be accepted and ignored. Ask for "unmanaged", or use a backend that can deny egress.',
    );
    this.name = "EgressUnsupportedError";
    this.backend = backend;
    this.egress = egress;
  }
}

/** A backend was asked for an option it cannot honour; refusing beats accepting and ignoring. */
export class UnsupportedOptionError extends Error {
  readonly backend: string;
  readonly option: string;

  constructor(backend: string, option: string, remedy: string) {
    super(
      'The ' +
        backend +
        ' backend cannot honour the option "' +
        option +
        '": ' +
        remedy +
        " Pass the option only to a backend that can honour it.",
    );
    this.name = "UnsupportedOptionError";
    this.backend = backend;
    this.option = option;
  }
}

/** The vendor SDK's own Node floor is above the one this package declares. */
export class UnsupportedNodeVersionError extends Error {
  readonly backend: string;
  readonly required: string;
  readonly actual: string;

  constructor(backend: string, required: string, actual: string) {
    super(
      'The ' +
        backend +
        " backend requires Node >= " +
        required +
        " (the vendor SDK's floor), but this process runs " +
        actual +
        ". Use the process backend, or run on a newer Node.",
    );
    this.name = "UnsupportedNodeVersionError";
    this.backend = backend;
    this.required = required;
    this.actual = actual;
  }
}
