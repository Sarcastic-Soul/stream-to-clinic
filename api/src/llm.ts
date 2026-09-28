// Language-model calls through Amazon Bedrock's Converse API, shared by the advisory and the agent.
// On the host the SDK signs requests with the EC2 instance role, so no model key is stored anywhere;
// the role may call only the models listed in BEDROCK_MODEL. Converse is the same request shape for
// every Bedrock model, so switching model is a configuration change.
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "./config.js";

export type ConverseRequest = ConverseCommandInput;
export type ConverseResponse = ConverseCommandOutput;
export type Converse = (request: ConverseRequest, signal: AbortSignal) => Promise<ConverseResponse>;

export const llmEnabled = () => config.bedrockModels.length > 0;

/** A count of requests per UTC day. It lives in memory, so a restart starts the day's count again. */
export class DailyLimit {
  private day = "";
  private count = 0;

  constructor(readonly limit: number) {}

  /** Counts one request and returns true, or returns false when today's limit is used up. */
  take(now = Date.now()): boolean {
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
    if (this.count >= this.limit) return false;
    this.count++;
    return true;
  }
}

/** One budget shared by every feature that calls a model. */
export const llmDailyLimit = new DailyLimit(config.llmDailyLimit);

export const DAILY_LIMIT_MESSAGE = "The AI features have used today's quota. Try again tomorrow.";

let client: BedrockRuntimeClient | undefined;

/** Sends one Converse request. Errors keep the SDK's names, which {@link isBusy} reads. */
export const converse: Converse = (request, signal) => {
  client ??= new BedrockRuntimeClient({ region: config.bedrockRegion, maxAttempts: 2 });
  return client.send(new ConverseCommand(request), { abortSignal: signal });
};

// Errors that say "this model cannot answer right now", as opposed to "this request is wrong":
// another model, or the same one a moment later, may still answer.
const BUSY_ERRORS = new Set([
  "ThrottlingException",
  "ServiceUnavailableException",
  "ServiceQuotaExceededException",
  "ModelNotReadyException",
  "ModelTimeoutException",
  "InternalServerException",
  "TimeoutError",
  "AbortError",
]);

export const isBusy = (err: unknown) => err instanceof Error && BUSY_ERRORS.has(err.name);

export const isTimeout = (err: unknown) => err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

/** The answer text of a model turn: text blocks only, leaving out any reasoning, including reasoning some models write inline in <thinking> tags. */
export function replyText(response: ConverseResponse): string {
  return (response.output?.message?.content ?? [])
    .map((block) => block.text ?? "")
    .join("")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .trim();
}
