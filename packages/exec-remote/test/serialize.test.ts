import { describe, expect, it } from "vitest";
import { PickleRefusedError, SerializationError } from "../src/errors.js";
import { decodeValue, encodeValue } from "../src/serialize.js";

describe("the host-owned value wire", () => {
  it("carries bytes as bytes in both directions", () => {
    const encoded = encodeValue(new Uint8Array([0, 1, 255]));
    expect(encoded).toEqual({ __t: "bytes", v: "AAH/" });
    const decoded = decodeValue(encoded) as Uint8Array;
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect([...decoded]).toEqual([0, 1, 255]);
  });

  it("carries a Date as a datetime tag", () => {
    const encoded = encodeValue(new Date("2026-10-14T12:00:00.000Z"));
    expect(encoded).toEqual({ __t: "datetime", v: "2026-10-14T12:00:00.000Z" });
    expect(decodeValue(encoded)).toEqual(new Date("2026-10-14T12:00:00.000Z"));
  });

  it("carries a Set and a Map", () => {
    expect(encodeValue(new Set([1, 2]))).toEqual({ __t: "set", v: [1, 2] });
    const map = encodeValue(new Map([["a", 1]]));
    expect(decodeValue(map)).toEqual(new Map([["a", 1]]));
  });

  it("decodes upstream's safe vocabulary", () => {
    expect(decodeValue({ __t: "tuple", v: [1, 2] })).toEqual([1, 2]);
    expect(decodeValue({ __t: "frozenset", v: ["a"] })).toEqual(new Set(["a"]));
    expect(decodeValue({ __t: "complex", re: 1, im: 2 })).toEqual({ real: 1, imag: 2 });
    expect(decodeValue({ __t: "date", v: "2026-10-14" })).toEqual(new Date("2026-10-14T00:00:00.000Z"));
    expect(decodeValue({ __t: "time", v: "12:30:00" })).toBe("12:30:00");
    expect(decodeValue({ __t: "timedelta", v: 90 })).toBe(90);
    expect(decodeValue({ __t: "decimal", v: "1.25" })).toBe("1.25");
    expect(decodeValue({ __t: "path", v: "/tmp/x" })).toBe("/tmp/x");
    expect(decodeValue({ __t: "bigint", v: "9007199254740993" })).toBe(9007199254740993n);
    expect(decodeValue({ __t: "dataclass", name: "Point", fields: { x: 1 } })).toEqual({
      __dataclass: "Point",
      x: 1,
    });
  });

  it("decodes a safe: payload as base64 JSON", () => {
    const payload = "safe:" + btoa(JSON.stringify({ a: [1, 2] }));
    expect(decodeValue(payload)).toEqual({ a: [1, 2] });
  });

  it("refuses a pickle: payload by default and carries raw bytes only when opted in", () => {
    expect(() => decodeValue("pickle:AAAA")).toThrow(PickleRefusedError);
    const bytes = decodeValue("pickle:AAAA", { allowPickle: true }) as Uint8Array;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([...bytes]).toEqual([0, 0, 0]);
  });

  it("refuses what the vocabulary cannot represent", () => {
    expect(() => encodeValue(() => undefined)).toThrow(SerializationError);
    expect(() => encodeValue(Symbol("x"))).toThrow(SerializationError);
    expect(() => encodeValue({ __t: "bytes" })).toThrow(SerializationError);
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(() => encodeValue(cyclic)).toThrow(SerializationError);
    expect(() => decodeValue({ __t: "mystery" })).toThrow(SerializationError);
  });

  it("decodes a plain object and array recursively", () => {
    expect(decodeValue({ a: [{ __t: "tuple", v: [1] }] })).toEqual({ a: [[1]] });
  });
});
