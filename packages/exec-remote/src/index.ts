/**
 * `@smolagents-ts/exec-remote` — the backend-neutral half of the package.
 *
 * The three backends are subpaths, so this entry resolves without a container client or a
 * vendor SDK. It carries the seam a fourth-backend author implements, the host-side executor
 * and its options, and the typed refusals; it imports no Node builtin and no vendor package.
 */

export { VERSION } from "./version.js";
export { RemoteExecutor, type RemoteExecutorOptions } from "./executor.js";
export {
  EgressUnsupportedError,
  MissingPeerDependencyError,
  PickleRefusedError,
  SandboxError,
  SerializationError,
  ToolRoundTripUnsupportedError,
  UnsupportedNodeVersionError,
} from "./errors.js";
export type {
  EgressPolicy,
  RemoteSandbox,
  RemoteSandboxFactory,
  SandboxCapabilities,
  SandboxFrame,
  SandboxOutput,
  SandboxOutputStream,
  SandboxRunOptions,
  SandboxRunResult,
  SandboxStartOptions,
  SandboxToolCall,
} from "./sandbox.js";
