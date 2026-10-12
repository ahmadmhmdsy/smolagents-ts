// packages/core/test/populate-template.test.ts
import { describe, expect, it } from "vitest";
import { TemplateError, populateTemplate, templateVariables } from "../src/prompts/populate-template.js";

describe("populateTemplate", () => {
  it("substitutes a variable", () => {
    expect(populateTemplate("Hello {{ name }}!", { name: "world" })).toBe("Hello world!");
  });

  it("substitutes without surrounding whitespace", () => {
    expect(populateTemplate("{{a}}{{b}}", { a: "1", b: "2" })).toBe("12");
  });

  it("substitutes every occurrence", () => {
    expect(populateTemplate("{{x}} and {{x}}", { x: "y" })).toBe("y and y");
  });

  it("accepts numbers", () => {
    expect(populateTemplate("max {{n}} steps", { n: 10 })).toBe("max 10 steps");
  });

  it("names the missing variable", () => {
    expect(() => populateTemplate("Hello {{ who }}", {})).toThrow(TemplateError);
    expect(() => populateTemplate("Hello {{ who }}", {})).toThrow(/who/);
  });

  it("leaves single braces alone", () => {
    expect(populateTemplate("a { b } c", {})).toBe("a { b } c");
  });

  it("leaves a non-identifier placeholder alone", () => {
    expect(populateTemplate("{{ not a name }}", {})).toBe("{{ not a name }}");
  });

  it("leaves an unterminated placeholder alone", () => {
    expect(populateTemplate("start {{ name", {})).toBe("start {{ name");
  });

  it("does not interpret replacement patterns inside a value", () => {
    expect(populateTemplate("{{x}}", { x: "$& $1 $' " })).toBe("$& $1 $' ");
  });

  it("reports the name of the first missing variable", () => {
    expect(() => populateTemplate("{{ok}} {{missing}}", { ok: "1" })).toThrow(/missing/);
  });

  it("refuses names inherited from Object.prototype", () => {
    for (const name of ["toString", "constructor", "valueOf", "__proto__", "hasOwnProperty"]) {
      expect(() => populateTemplate("{{" + name + "}}", {})).toThrow(TemplateError);
    }
  });

  it("accepts an own property that shadows a prototype member", () => {
    expect(populateTemplate("{{ toString }}", { toString: "mine" })).toBe("mine");
  });
});

describe("templateVariables", () => {
  it("lists each placeholder once, in order", () => {
    expect(templateVariables("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });

  it("ignores non-placeholders", () => {
    expect(templateVariables("{ x } {{ ok }}")).toEqual(["ok"]);
  });
});
