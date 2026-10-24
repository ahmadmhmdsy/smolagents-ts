import type { TokenUsage } from "../types.js";

/**
 * The day the rows in `DEFAULT_PRICE_TABLE` were transcribed from the providers' published
 * pricing pages. A price table is a dated claim, not a live quote: a caller that needs newer
 * numbers passes its own table, and the run reports which date it costed against.
 */
export const PRICE_TABLE_DATE = "2026-10-25";

/**
 * One published list price, per million tokens. A row matches a model by provider and by the
 * longest prefix of its id, so a dated model alias costs the same as the family it belongs to.
 */
export interface ModelPrice {
  /** The adapter family, as `Model.provider` reports it. */
  readonly provider: string;
  /** The model id prefix this row prices; the longest matching prefix wins. */
  readonly modelPrefix: string;
  readonly currency: "USD";
  /** The day this row was published by the provider. */
  readonly effectiveDate: string;
  readonly inputPerMTokUsd: number;
  /** The cached-input rate; absent means the provider publishes none for this model. */
  readonly cachedInputPerMTokUsd?: number;
  /** The cache-write rate; absent means the provider publishes none for this model. */
  readonly cacheWriteInputPerMTokUsd?: number;
  readonly outputPerMTokUsd: number;
  /** Where the row was read, so a reader can check it. */
  readonly source: string;
}

/**
 * Three standard list-price rows, one per adapter family, read on `PRICE_TABLE_DATE`. These are
 * examples a caller can use as is or replace: usage the adapter does not split is priced at the
 * input rate, and a model not in the table has no cost at all rather than a made-up zero.
 */
export const DEFAULT_PRICE_TABLE: readonly ModelPrice[] = [
  {
    provider: "anthropic",
    modelPrefix: "claude-sonnet-4-5",
    currency: "USD",
    effectiveDate: PRICE_TABLE_DATE,
    inputPerMTokUsd: 3,
    cachedInputPerMTokUsd: 0.3,
    cacheWriteInputPerMTokUsd: 3.75,
    outputPerMTokUsd: 15,
    source: "https://platform.claude.com/docs/en/about-claude/pricing",
  },
  {
    provider: "openai",
    modelPrefix: "gpt-6.1-sol",
    currency: "USD",
    effectiveDate: PRICE_TABLE_DATE,
    inputPerMTokUsd: 2,
    cachedInputPerMTokUsd: 0.1,
    // The standard prompt-caching write rate for the 30-minute retention window.
    cacheWriteInputPerMTokUsd: 2.5,
    outputPerMTokUsd: 10,
    source: "https://developers.openai.com/api/docs/pricing",
  },
  {
    provider: "google",
    modelPrefix: "gemini-3.5-flash-lite",
    currency: "USD",
    effectiveDate: PRICE_TABLE_DATE,
    inputPerMTokUsd: 0.3,
    cachedInputPerMTokUsd: 0.03,
    outputPerMTokUsd: 2.5,
    source: "https://ai.google.dev/gemini-api/docs/pricing",
  },
];

/** Which model to price, and optionally a table to price it from instead of the shipped one. */
export interface ModelPriceQuery {
  readonly provider: string;
  readonly model: string;
  readonly table?: readonly ModelPrice[];
}

/** The row that prices this model, or `undefined` when the table does not price it. */
export function findModelPrice(query: ModelPriceQuery): ModelPrice | undefined {
  const table = query.table ?? DEFAULT_PRICE_TABLE;
  let found: ModelPrice | undefined;
  for (const price of table) {
    if (price.provider !== query.provider) continue;
    if (!query.model.startsWith(price.modelPrefix)) continue;
    if (found === undefined || price.modelPrefix.length > found.modelPrefix.length) found = price;
  }
  return found;
}

/** The usage split a cost was computed over, kept so the number can be checked. */
export interface CostBasis {
  readonly currency: "USD";
  /** The day the matched row was published by the provider. */
  readonly effectiveDate: string;
  readonly price: ModelPrice;
  readonly uncachedInputTokens: number;
  readonly cachedInputTokens: number;
  readonly cacheWriteInputTokens: number;
  readonly outputTokens: number;
}

/** A priced run's cost, as a decimal string and as integer micro-dollars. */
export interface RunCost {
  /** Six decimal places of USD, for display and for a stable test assertion. */
  readonly costUsd: string;
  /** The same cost in integer micro-dollars, the unit the budget counts. */
  readonly microUsd: number;
  readonly basis: CostBasis;
}

const MICRO_PER_USD = 1_000_000;

/** A per-million-token price as integer micro-dollars per million tokens. */
function microPerMTok(usdPerMTok: number): number {
  return Math.round(usdPerMTok * MICRO_PER_USD);
}

/**
 * Price one turn's usage, or `undefined` when no row matches it. The arithmetic is integer
 * micro-dollars throughout, so a long run's total cannot drift; a cached or cache-write split the
 * row does not price falls back to the input rate, which is what the provider bills for it.
 */
export function deriveCost(usage: TokenUsage, query: ModelPriceQuery): RunCost | undefined {
  const price = findModelPrice(query);
  if (price === undefined) return undefined;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const cacheWriteInputTokens = usage.cacheWriteInputTokens ?? 0;
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens - cacheWriteInputTokens);
  const micro = (tokens: number, ratePerMTok: number): number =>
    Math.round((tokens * microPerMTok(ratePerMTok)) / MICRO_PER_USD);
  const microUsd =
    micro(uncachedInputTokens, price.inputPerMTokUsd) +
    micro(cachedInputTokens, price.cachedInputPerMTokUsd ?? price.inputPerMTokUsd) +
    micro(cacheWriteInputTokens, price.cacheWriteInputPerMTokUsd ?? price.inputPerMTokUsd) +
    micro(usage.outputTokens, price.outputPerMTokUsd);
  return {
    costUsd: formatMicroUsd(microUsd),
    microUsd,
    basis: {
      currency: "USD",
      effectiveDate: price.effectiveDate,
      price,
      uncachedInputTokens,
      cachedInputTokens,
      cacheWriteInputTokens,
      outputTokens: usage.outputTokens,
    },
  };
}

/** Integer micro-dollars as a six-decimal USD string. */
export function formatMicroUsd(microUsd: number): string {
  const whole = Math.floor(microUsd / MICRO_PER_USD);
  const fraction = String(microUsd % MICRO_PER_USD).padStart(6, "0");
  return whole + "." + fraction;
}
