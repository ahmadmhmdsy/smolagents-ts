import { describe, expect, it } from "vitest";
import { parseArguments } from "../src/args.js";
import { CliUsageError, HelpRequested } from "../src/errors.js";

describe("parseArguments", () => {
  it("defaults every flag when only the prompt is given", () => {
    const args = parseArguments(["do the thing"]);

    expect(args.prompt).toBe("do the thing");
    expect(args.modelType).toBe("InferenceClientModel");
    expect(args.actionType).toBe("code");
    expect(args.modelId).toBe("Qwen/Qwen3-Next-80B-A3B-Thinking");
    expect(args.tools).toEqual(["web_search"]);
    expect(args.imports).toEqual([]);
    expect(args.verbosityLevel).toBe(1);
    expect(args.provider).toBeUndefined();
    expect(args.apiBase).toBeUndefined();
    expect(args.apiKey).toBeUndefined();
  });

  it("omits the prompt when it was not given", () => {
    expect("prompt" in parseArguments([])).toBe(false);
  });

  it("reads a value after the flag and after an equals sign", () => {
    expect(parseArguments(["--model-id", "a"]).modelId).toBe("a");
    expect(parseArguments(["--model-id=b"]).modelId).toBe("b");
  });

  it("reads a space-separated list into tools and imports", () => {
    const args = parseArguments([
      "--tools",
      "web_search",
      "visit_webpage",
      "--imports",
      "math",
      "json",
    ]);

    expect(args.tools).toEqual(["web_search", "visit_webpage"]);
    expect(args.imports).toEqual(["math", "json"]);
  });

  it("replaces the default list when the flag carries no value", () => {
    expect(parseArguments(["--tools"]).tools).toEqual([]);
  });

  it("keeps positional text after -- as the prompt", () => {
    const args = parseArguments(["--", "--tools"]);

    expect(args.prompt).toBe("--tools");
    expect(args.tools).toEqual(["web_search"]);
  });

  it("parses an integer verbosity, including a negative one", () => {
    expect(parseArguments(["--verbosity-level", "2"]).verbosityLevel).toBe(2);
    expect(parseArguments(["--verbosity-level=-1"]).verbosityLevel).toBe(-1);
  });

  it("reads a negative number after a space as the flag's value, as argparse does", () => {
    expect(parseArguments(["--verbosity-level", "-1", "go"]).verbosityLevel).toBe(-1);
    expect(parseArguments(["-5"]).prompt).toBe("-5");
    expect(parseArguments(["--model-id", "-0.5"]).modelId).toBe("-0.5");
    expect(() => parseArguments(["--verbosity-level", "-x"])).toThrow(CliUsageError);
  });

  it("throws HelpRequested for --help and -h", () => {
    expect(() => parseArguments(["--help"])).toThrow(HelpRequested);
    expect(() => parseArguments(["-h"])).toThrow(HelpRequested);
    try {
      parseArguments(["--help"]);
    } catch (error) {
      expect((error as HelpRequested).usage).toContain("Usage: smolagent");
      expect((error as HelpRequested).exitCode).toBe(0);
    }
  });

  it("rejects an unknown flag with exit code 2", () => {
    try {
      parseArguments(["--nope"]);
      throw new Error("parseArguments should have refused --nope");
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).exitCode).toBe(2);
      expect((error as Error).message).toContain("--nope");
    }
  });

  it("rejects a flag whose value is missing", () => {
    expect(() => parseArguments(["--model-id"])).toThrow(CliUsageError);
  });

  it("rejects a non-integer verbosity", () => {
    expect(() => parseArguments(["--verbosity-level", "fast"])).toThrow(CliUsageError);
  });

  it("rejects a second positional", () => {
    expect(() => parseArguments(["one", "two"])).toThrow(CliUsageError);
  });

  it("carries provider, api base and key", () => {
    const args = parseArguments([
      "--provider",
      "together",
      "--api-base",
      "https://example.test/v1",
      "--api-key",
      "secret",
    ]);

    expect(args.provider).toBe("together");
    expect(args.apiBase).toBe("https://example.test/v1");
    expect(args.apiKey).toBe("secret");
  });

  it("carries the action type", () => {
    expect(parseArguments(["--action-type", "tool_calling"]).actionType).toBe("tool_calling");
  });

  it("reads the durability flags and default state directory", () => {
    const args = parseArguments([
      "--run-id",
      "run-7",
      "--resume",
      "run-6",
      "--approve",
      "req-2",
      "--state-dir",
      "state",
      "go",
    ]);

    expect(args.runId).toBe("run-7");
    expect(args.resume).toBe("run-6");
    expect(args.approve).toBe("req-2");
    expect(args.stateDir).toBe("state");
  });

  it("defaults the state directory beside the working directory", () => {
    expect(parseArguments([]).stateDir).toBe(".smolagents");
  });

  it("carries the fork pair and rejects a half of it", () => {
    const args = parseArguments(["--fork", "parent-1", "--fork-step", "2", "go"]);
    expect(args.fork).toBe("parent-1");
    expect(args.forkStep).toBe(2);
    expect(() => parseArguments(["--fork", "parent-1", "go"])).toThrow(CliUsageError);
    expect(() => parseArguments(["--fork-step", "2", "go"])).toThrow(CliUsageError);
    expect(() => parseArguments(["--fork", "parent-1", "--fork-step", "x", "go"])).toThrow(
      CliUsageError,
    );
    expect(() =>
      parseArguments(["--fork", "parent-1", "--fork-step", "1", "--resume", "r", "go"]),
    ).toThrow(CliUsageError);
  });

  it("carries a conversation id", () => {
    expect(parseArguments(["--conversation", "conv-2", "go"]).conversation).toBe("conv-2");
  });

  it("rejects --approve unless --resume or --conversation names the run", () => {
    expect(() => parseArguments(["--approve", "req-1", "go"])).toThrow(CliUsageError);
    expect(parseArguments(["--conversation", "conv-1", "--approve", "req-1"]).approve).toBe(
      "req-1",
    );
  });

  it("documents the durability flags in the help text", () => {
    try {
      parseArguments(["--help"]);
    } catch (error) {
      const usage = (error as HelpRequested).usage;
      expect(usage).toContain("--run-id");
      expect(usage).toContain("--resume");
      expect(usage).toContain("--approve");
      expect(usage).toContain("--conversation");
      expect(usage).toContain("--fork");
      expect(usage).toContain("--state-dir");
    }
  });

});
