import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { HuggingFaceModel } from "smolagents-ts/models";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

/** Models the Inference Providers router serves that follow the code-action format well. */
export const LIVE_MODELS = [
  "Qwen/Qwen3-Next-80B-A3B-Instruct",
  "openai/gpt-oss-120b",
  "deepseek-ai/DeepSeek-V3.2",
  "meta-llama/Llama-3.3-70B-Instruct",
] as const;

export const SCRIPTED_TASK = "Look up Hugging Face on Wikipedia and say where the company is based.";

export const DEFAULT_LIVE_TASK =
  "How many years passed between the founding of Hugging Face and the first iPhone? " +
  "Check both dates on Wikipedia.";

/** The REST summary endpoint answers any origin, so the browser can call it directly. */
const WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * The one network tool. Search and scrape endpoints refuse cross-origin requests, so a
 * browser-only page cannot use the CLI's web_search; Wikipedia's summary API allows them.
 */
export function wikipediaTool(fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
  return tool({
    name: "wikipedia_summary",
    description:
      "Return the lead summary of an English Wikipedia article. Pass the article title, " +
      'for example "Hugging Face" or "IPhone (1st generation)".',
    inputSchema: z.object({ title: z.string() }),
    execute: async ({ title }) => {
      const url = WIKIPEDIA_SUMMARY + encodeURIComponent(title.replace(/ /g, "_"));
      const response = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (!response.ok) return "No article found for " + JSON.stringify(title) + " (HTTP " + response.status + ").";
      const page = (await response.json()) as { title?: string; extract?: string };
      return (page.title ?? title) + ": " + (page.extract ?? "(no summary)");
    },
  });
}

export interface DemoRun {
  readonly agent: CodeAgent;
  readonly executor: QuickJSExecutor;
}

const turn = (thought: string, program: string): string =>
  ["Thought: " + thought, "Code:", CODE_FENCE, program, CODE_FENCE].join("\n");

/**
 * The run a visitor sees before signing in. Only the model is scripted: the program runs in
 * the real QuickJS sandbox and the tool makes a real Wikipedia request.
 */
export function createScriptedRun(fetchImpl?: FetchLike): DemoRun {
  const executor = new QuickJSExecutor();
  const model = new MockModel([
    turn(
      "read the article's summary, then answer from it.",
      ['const page = await wikipedia_summary({ title: "Hugging Face" });', "console.log(page);"].join("\n"),
    ),
    turn(
      "the summary says where the company is based, so read it from the log and answer.",
      [
        "const city = page.match(/based in ([^.,]+)/)?.[1];",
        'final_answer(city ? "Hugging Face is based in " + city + "." : page.split(". ")[0] + ".");',
      ].join("\n"),
    ),
  ]);
  return { agent: new CodeAgent({ model, executor, tools: [wikipediaTool(fetchImpl)] }), executor };
}

export interface LiveRunOptions {
  /** The signed-in visitor's OAuth token. It goes only to router.huggingface.co. */
  readonly accessToken: string;
  readonly model: string;
  readonly fetch?: FetchLike;
}

/** A real model through the Inference Providers router, billed to the signed-in visitor. */
export function createLiveRun(options: LiveRunOptions): DemoRun {
  const executor = new QuickJSExecutor();
  const model = new HuggingFaceModel({
    model: options.model,
    apiKey: options.accessToken,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  return {
    agent: new CodeAgent({ model, executor, tools: [wikipediaTool(options.fetch)], maxSteps: 6 }),
    executor,
  };
}
