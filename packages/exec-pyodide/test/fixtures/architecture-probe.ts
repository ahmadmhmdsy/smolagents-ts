// A fixture the architecture walker follows to prove it fails on a Node builtin. It is never
// imported by src/, only by the architecture test.
import "node:child_process";

export const probe = "node";
