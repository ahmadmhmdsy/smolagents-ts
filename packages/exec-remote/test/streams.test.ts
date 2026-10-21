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
  });

  it("keeps the head and the tail inside the cap once it is passed", () => {
    const out = truncateContent("x".repeat(60_000));
    expect(out.length).toBeLessThanOrEqual(MAX_PRINT_OUTPUT_LENGTH);
    expect(out).toContain("_This content has been truncated to stay below 50000 characters_");
  });

  it("defaults to upstream's 50000-character print cap", () => {
    expect(MAX_PRINT_OUTPUT_LENGTH).toBe(50_000);
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
    expect(stream.bufferedLength).toBe(0);
  });

  it("truncates the joined text rather than each line", () => {
    const stream = new LogStream();
    stream.write("a".repeat(40_000));
    stream.write("Z".repeat(40_000));
    expect(stream.bufferedLength).toBe(80_002);
    const text = stream.text;
    expect(text.length).toBeLessThanOrEqual(MAX_PRINT_OUTPUT_LENGTH);
    expect(text.startsWith("a".repeat(100))).toBe(true);
    expect(text.endsWith("Z".repeat(100))).toBe(true);
    expect(text).toContain("_This content has been truncated to stay below 50000 characters_");
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
