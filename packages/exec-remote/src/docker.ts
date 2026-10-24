/** `@smolagents-ts/exec-remote/docker`: a guest reached over one long-lived `docker exec` session. */
import type { CodeExecutor } from "@smolagents-ts/core";

import {
  DockerSandbox,
  type DockerSandboxOptions,
} from "./backends/docker/index.js";
import { RemoteExecutor } from "./executor.js";

export {
  DOCKERFILE,
  DockerSandbox,
  dockerfileTar,
  imageTagFor,
  type ContainerCreateRequest,
  type ContainerRuntime,
  type DockerSandboxOptions,
  type ExecSession,
  type ExecSessionOptions,
  type ImageBuildRequest,
} from "./backends/docker/index.js";

/**
 * The `CodeExecutor` the Docker backend offers. The guest's stdio is one duplex session, so a
 * tool frame crosses the same stdin the step arrived on, as it does in the process backend.
 */
export function createDockerExecutor(options: DockerSandboxOptions = {}): CodeExecutor {
  return new RemoteExecutor({
    // A thunk, so a step that loses the deadline race gets a fresh container.
    sandbox: () => new DockerSandbox(options),
  });
}
