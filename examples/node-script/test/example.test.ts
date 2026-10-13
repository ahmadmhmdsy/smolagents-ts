import { expect, test } from "vitest";

import { main } from "../index.mjs";

test("the example answers through a tool call in the sandbox", async () => {
  await expect(main()).resolves.toBe("Hello, world!");
});
