"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PlugIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, FHIR_URL, MCP_URL } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AgentAnswer, AgentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SUGGESTIONS = [
  "Which stream sites have an active alert, and why?",
  "Is any stream warming up or losing oxygen?",
  "Which clinics were warned, and have they answered?",
  "What did citizens report at Almyros this week?",
];

const TOOL_LABEL: Record<string, string> = {
  list_sites: "Stream sites",
  list_clinics: "Clinics",
  list_alerts: "Active alerts",
  get_trends: "Catchment trends",
  site_observations: "Citizen readings",
  search_fhir: "FHIR search",
};

// What the loading state walks through while the one request is out. The real steps replace it.
const THINKING = ["Reading the question", "Querying the FHIR server", "Writing the answer from the results"];

/** "https://host/fhir/DetectedIssue?code=…" → "GET DetectedIssue?code=…", shortened for the eye. */
function queryLabel(url: string): string {
  const path = decodeURIComponent(url.startsWith(FHIR_URL) ? url.slice(FHIR_URL.length + 1) : url.replace(/^https?:\/\/[^/]+\/fhir\//, ""));
  return path.length > 90 ? `${path.slice(0, 88)}…` : path;
}

// The model may use "- " bullets and **bold**; nothing else is rendered as markup.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={blocks.length} className="space-y-1.5 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-3 text-[0.95rem] leading-relaxed">{blocks}</div>;
}

function Thinking() {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setShown((n) => Math.min(n + 1, THINKING.length)), 1600);
    return () => clearInterval(timer);
  }, []);
  return (
    <div data-testid="agent-loading" role="status" aria-live="polite" className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircleIcon className="size-4 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
        Working on it…
      </div>
      <ol className="space-y-2">
        {THINKING.slice(0, shown).map((label, i) => (
          <li key={label} className="flex animate-in items-center gap-2 text-sm text-muted-foreground fade-in slide-in-from-bottom-1">
            {i < shown - 1 ? (
              <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <span className="size-2 animate-pulse rounded-full bg-sky-500" aria-hidden />
            )}
            {label}
          </li>
        ))}
      </ol>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[agent-scan_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400" />
      </div>
    </div>
  );
}

function Step({ step, index }: { step: AgentStep; index: number }) {
  return (
    <li
      data-testid="agent-step"
      className="relative flex animate-in gap-3 fade-in slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${150 + index * 180}ms` }}
    >
      <div
        className={cn(
          "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold",
          step.error ? "border-destructive text-destructive" : "border-sky-500 text-sky-700 dark:text-sky-300",
        )}
        aria-hidden
      >
        {step.error ? <CircleAlertIcon className="size-4" /> : index + 1}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{TOOL_LABEL[step.tool] ?? step.tool}</span>
          <code className="text-xs text-muted-foreground">{step.tool}</code>
        </div>
        <p className={cn("text-sm", step.error ? "text-destructive" : "text-muted-foreground")}>{step.summary}</p>
        {step.fhirUrls.length > 0 && (
          <ul className="space-y-1">
            {step.fhirUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-accent"
                >
                  <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">GET</span>
                  <span className="truncate">{queryLabel(url)}</span>
                  <ExternalLinkIcon className="size-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
                  <span className="sr-only">(opens the FHIR query in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function McpCard() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the URL stays selectable.
    }
  }
  return (
    <section aria-labelledby="mcp-heading" className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 id="mcp-heading" className="flex items-center gap-2 font-semibold">
        <PlugIcon className="size-5 text-violet-600 dark:text-violet-400" aria-hidden />
        Bring your own assistant
      </h2>
      <p className="text-sm text-muted-foreground">
        The same read-only tools are an MCP server. Add this URL as a remote MCP server (a custom connector) in Claude or any
        MCP client, and ask it about the streams with your own model.
      </p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-1.5 pl-3">
        <code id="mcp-url" className="min-w-0 flex-1 truncate text-sm">
          {MCP_URL}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </section>
  );
}

export function AskAgent({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 3 || busy) return;
    setQuestion(q);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.askAgent(q));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? "No model is configured on this server, so the agent is switched off. The MCP server below works without one."
          : err instanceof Error
            ? err.message
            : "The question could not be answered.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (result || error) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result, error]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const queries = result?.steps.reduce((n, s) => n + s.fhirUrls.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 p-5 shadow-sm sm:p-6 dark:from-sky-950/60 dark:via-cyan-950/40 dark:to-emerald-950/40">
        <div
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/20"
          aria-hidden
        />
        <form onSubmit={submit} className="relative space-y-4">
          <label htmlFor="agent-question" className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="size-5 text-sky-600 dark:text-sky-400" aria-hidden />
            Ask a question about the streams
          </label>
          <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-4 shadow-sm focus-within:ring-3 focus-within:ring-ring/50">
            <input
              id="agent-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder="e.g. Which stream is losing oxygen?"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <Button id="agent-ask" type="submit" size="icon-lg" className="rounded-xl" disabled={busy || question.trim().length < 3} aria-label="Ask">
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <ArrowUpIcon />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                id={`suggestion-${i + 1}`}
                data-testid="agent-suggestion"
                type="button"
                disabled={busy}
                onClick={() => void ask(s)}
                className="rounded-full border bg-card/80 px-3 py-1.5 text-left text-sm shadow-xs transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-sm disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </section>

      <div ref={resultRef} className="scroll-mt-20 space-y-6">
        {busy && <Thinking />}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {result && (
          <>
            <section
              id="agent-answer"
              aria-labelledby="answer-heading"
              className="animate-in space-y-4 rounded-2xl border bg-card p-5 shadow-sm fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-sm">
                  <BotIcon className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h2 id="answer-heading" className="font-semibold">
                    Answer
                  </h2>
                  <p className="text-sm text-muted-foreground">{result.question}</p>
                </div>
              </div>
              <AnswerText text={result.answer} />
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Written by {result.model} on <time dateTime={result.answeredAt}>{formatDateTime(result.answeredAt)}</time>, from{" "}
                {queries} FHIR {queries === 1 ? "query" : "queries"} it ran itself. It can only read; it never changes a risk level.
              </p>
            </section>

            <section id="agent-steps" aria-labelledby="steps-heading" className="space-y-4">
              <h2 id="steps-heading" className="flex items-center gap-2 font-semibold">
                <DatabaseIcon className="size-5 text-sky-600 dark:text-sky-400" aria-hidden />
                How it got there
              </h2>
              {result.steps.length ? (
                <ol className="relative before:absolute before:top-4 before:bottom-6 before:left-4 before:w-px before:bg-border">
                  {result.steps.map((step, i) => (
                    <Step key={i} step={step} index={i} />
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">It answered without querying the data.</p>
              )}
            </section>
          </>
        )}
      </div>

      <McpCard />
    </div>
  );
}
