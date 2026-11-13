import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CODE_FENCE } from "smolagents-ts";
import { App, explainRunError } from "../src/App.js";
import { createLiveRun, createScriptedRun } from "../src/agent.js";
import { clearSession, readSession, saveSession, spaceOAuthAvailable } from "../src/auth.js";

const SUMMARY =
  "Hugging Face, Inc., is an American company based in New York City. Its online platform allows users to share models.";

/** Answers Wikipedia with a fixed summary and records every request it saw. */
function fakeFetch(modelReplies: string[] = []) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (url.startsWith("https://en.wikipedia.org/")) {
      return new Response(JSON.stringify({ title: "Hugging Face", extract: SUMMARY }), { status: 200 });
    }
    const content = modelReplies.shift() ?? "";
    return new Response(
      JSON.stringify({
        id: "x",
        object: "chat.completion",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { impl, calls };
}

afterEach(() => {
  clearSession();
});

describe("the scripted run", () => {
  it("calls the Wikipedia tool from the sandbox and answers from its summary", async () => {
    const { impl, calls } = fakeFetch();
    const { agent, executor } = createScriptedRun(impl);
    try {
      const result = await agent.run("where is it based?");
      expect(result.output).toBe("Hugging Face is based in New York City.");
      expect(calls[0]?.url).toBe("https://en.wikipedia.org/api/rest_v1/page/summary/Hugging_Face");
    } finally {
      await executor.dispose();
    }
  });
});

describe("the live run", () => {
  it("sends the visitor's token to the Inference Providers router with the chosen model", async () => {
    const program = 'final_answer("done");';
    const { impl, calls } = fakeFetch(["Thought: answer.\nCode:\n" + CODE_FENCE + "\n" + program + "\n" + CODE_FENCE]);
    const { agent, executor } = createLiveRun({ accessToken: "hf_oauth_test", model: "openai/gpt-oss-120b", fetch: impl });
    try {
      const result = await agent.run("say done");
      expect(result.output).toBe("done");
      const request = calls.find((call) => call.url.startsWith("https://router.huggingface.co/"));
      expect(request?.url).toBe("https://router.huggingface.co/v1/chat/completions");
      const headers = new Headers(request?.init.headers);
      expect(headers.get("authorization")).toBe("Bearer hf_oauth_test");
      expect(JSON.parse(String(request?.init.body)).model).toBe("openai/gpt-oss-120b");
    } finally {
      await executor.dispose();
    }
  });
});

describe("the session helpers", () => {
  it("detects a static Space's OAuth client id", () => {
    expect(spaceOAuthAvailable({})).toBe(false);
    expect(spaceOAuthAvailable({ huggingface: { variables: { OAUTH_CLIENT_ID: "" } } })).toBe(false);
    expect(spaceOAuthAvailable({ huggingface: { variables: { OAUTH_CLIENT_ID: "abc" } } })).toBe(true);
  });

  it("keeps a session until it expires, then drops it", () => {
    saveSession({ accessToken: "t", expiresAt: 2_000, username: "someone" });
    expect(readSession(1_000)?.username).toBe("someone");
    expect(readSession(2_000)).toBeNull();
    expect(readSession(1_000)).toBeNull();
  });
});

describe("the page", () => {
  const scripted = () => createScriptedRun(fakeFetch().impl);

  it("runs the scripted agent and offers sign-in inside a Space", async () => {
    await act(async () => {
      render(<App initialSession={null} oauthAvailable createScripted={scripted} />);
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Finished"));
    expect(document.body.textContent).toContain("Hugging Face is based in New York City.");
    expect(screen.getByRole("button", { name: "Sign in with Hugging Face" })).toBeTruthy();
  });

  it("says why there is no sign-in outside a Space", async () => {
    await act(async () => {
      render(<App initialSession={null} oauthAvailable={false} createScripted={scripted} />);
    });
    expect(screen.queryByRole("button", { name: "Sign in with Hugging Face" })).toBeNull();
    expect(document.body.textContent).toContain("works when this page runs as a Hugging Face Space");
  });

  it("shows the model picker and the visitor's name once signed in", async () => {
    await act(async () => {
      render(
        <App
          initialSession={{ accessToken: "t", expiresAt: Date.now() + 60_000, username: "someone" }}
          oauthAvailable
          createScripted={scripted}
        />,
      );
    });
    expect(document.body.textContent).toContain("Signed in as someone");
    const live = screen.getByRole("radio", { name: /real model/ });
    await act(async () => {
      live.click();
    });
    expect(screen.getByLabelText("Model")).toBeTruthy();
  });

  it("says why a live run failed when the account has no credits", async () => {
    const noCredits = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "Purchase pre-paid credits to continue using Inference Providers." }), {
        status: 402,
      });
    await act(async () => {
      render(
        <App
          initialSession={{ accessToken: "t", expiresAt: Date.now() + 60_000, username: "someone" }}
          oauthAvailable
          createScripted={scripted}
          createLive={(options) => createLiveRun({ ...options, fetch: noCredits })}
        />,
      );
    });
    await act(async () => {
      screen.getByRole("radio", { name: /real model/ }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Run" }).click();
    });
    const alert = await screen.findByRole("alert", {}, { timeout: 15_000 });
    expect(alert.textContent).toContain("no Inference Providers credits left");
    expect(alert.textContent).toContain("HTTP 402");
    expect(screen.getByRole("link", { name: "Open billing settings" }).getAttribute("href")).toBe(
      "https://huggingface.co/settings/billing",
    );
  }, 30_000);
});

describe("explainRunError", () => {
  it("maps the provider's status to advice, and leaves the rest alone", () => {
    expect(explainRunError("HTTP 401 from x")).toContain("Sign out, sign in again");
    expect(explainRunError("HTTP 429 from x")).toContain("rate-limiting");
    expect(explainRunError("HTTP 500 from x")).toBeNull();
    expect(explainRunError("the program threw")).toBeNull();
  });
});
