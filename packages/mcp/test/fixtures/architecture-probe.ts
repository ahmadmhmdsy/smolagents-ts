// A throwaway probe for the architecture test's negative case: it must fail the walk.
import { spawn } from "node:child_process";

export const probe = spawn;
