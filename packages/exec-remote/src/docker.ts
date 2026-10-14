/** `@smolagents-ts/exec-remote/docker`: a Docker-hosted Jupyter Kernel Gateway. */
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
  type ContainerEndpoint,
  type ContainerRuntime,
  type DockerSandboxOptions,
  type ImageBuildRequest,
} from "./backends/docker/index.js";

/**
 * The `CodeExecutor` the Docker backend offers. The kernel's stdin channel answers the guest's
 * blocking tool read, so the tool round trip works here as it does in the process backend.
 */
export function createDockerExecutor(options: DockerSandboxOptions = {}): CodeExecutor {
  const sandbox = new DockerSandbox(options);
  return new RemoteExecutor({
    sandbox,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}
