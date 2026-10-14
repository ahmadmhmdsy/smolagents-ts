import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// testing-library's automatic cleanup relies on a global afterEach, and this project
// imports its test functions from "vitest" instead of enabling globals, so the cleanup
// is registered here. Measured during the S5 spike: without it a rendered tree survives
// into the next test in the same file.
afterEach(() => {
  cleanup();
});
