import { describe, expect, it } from "vitest";

import {
  LogStream,
  MAX_LOG_BUFFER_LENGTH,
  MAX_PRINT_OUTPUT_LENGTH,
  truncateContent,
} from "../src/streams.js";

describe("truncateContent", () => {
  it("returns content at or below the cap unchanged", () => {
    expect(truncateContent("abc", 3)).toBe("abc");
    expect(truncateContent("", 10)).toBe("");
    expect(truncateContent("abcd", 10)).toBe("abcd");
  });

  it("keeps the head and the tail with upstream's marker once the cap is passed", () => {
    const content = "a".repeat(30) + "MIDDLE" + "Z".repeat(30);
    const out = truncateContent(content, 40);
    expect(out).toContain("_This content has been truncated to stay below 40 characters_");
    expect(out.startsWith("a".repeat(20))).toBe(true);
    expect(out.endsWith("Z".repeat(20))).toBe(true);
    expect(out).not.toContain("MIDDLE");
  });

  it("defaults to upstream's 50000-character print cap", () => {
    expect(MAX_PRINT_OUTPUT_LENGTH).toBe(50_000);
    const out = truncateContent("x".repeat(60_000));
    expect(out).toContain("stay below 50000 characters");
  });
});

describe("LogStream", () => {
  it("rejoins whole lines with a newline and forwards every line live", () => {
    const seen: string[] = [];
    const stream = new LogStream((line) => seen.push(line));
    stream.write("hello");
    stream.write("2");
    expect(seen).toEqual(["hello", "2"]);
    expect(stream.lineCount).toBe(2);
    expect(stream.text).toBe("hello\n2");
  });

  it("is empty until something is written", () => {
    const stream = new LogStream();
    expect(stream.lineCount).toBe(0);
    expect(stream.text).toBe("");
  });

  it("truncates the joined text rather than each line", () => {
    const stream = new LogStream();
    stream.write("a".repeat(40_000));
    stream.write("Z".repeat(40_000));
    expect(stream.text.length).toBeLessThan(80_000);
    expect(stream.text).toContain("_This content has been truncated to stay below 50000 characters_");
  });

  it("keeps one megabyte per run by default", () => {
    expect(MAX_LOG_BUFFER_LENGTH).toBe(1_048_576);
  });

  it("bounds the buffer at write time and marks the dropped middle", () => {
    const stream = new LogStream(undefined, 200);
    for (let index = 0; index < 100; index += 1) {
      stream.write(String(index).padStart(4, "0") + "x".repeat(96));
    }
    expect(stream.lineCount).toBe(100);
    expect(stream.bufferedLength).toBeLessThanOrEqual(200);
    const text = stream.text;
    expect(text.startsWith("0000")).toBe(true);
    expect(text.endsWith("x")).toBe(true);
    expect(text).toContain("_This content has been truncated to stay below 200 characters_");
  });

  it("bounds a single oversized line too", () => {
    const stream = new LogStream(undefined, 1_000);
    stream.write("x".repeat(100_000));
    expect(stream.bufferedLength).toBeLessThanOrEqual(1_000);
    expect(stream.text).toContain("_This content has been truncated");
  });

  it("stays bounded across a long run of small writes", () => {
    const stream = new LogStream(undefined, 100);
    for (let index = 0; index < 5_000; index += 1) stream.write("y");
    expect(stream.lineCount).toBe(5_000);
    expect(stream.bufferedLength).toBeLessThanOrEqual(100);
    expect(stream.text.length).toBeLessThan(200);
    expect(stream.text.endsWith("y")).toBe(true);
  });
});
