import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// testing-library's automatic cleanup needs a global afterEach, and this project imports its
// test functions from "vitest" instead of enabling globals, so the cleanup is registered here.
afterEach(() => {
  cleanup();
});
