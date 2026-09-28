import type { Metadata } from "next";
import { AskAgent } from "@/components/ask/ask-agent";

export const metadata: Metadata = { title: "Ask the data" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Ask the data</h1>
        <p className="text-muted-foreground">
          Ask in plain words. An AI agent answers by querying the FHIR server itself, read-only, and shows every query it
          ran so you can check the answer against the source.
        </p>
      </div>
      <AskAgent initialQuestion={typeof q === "string" ? q.slice(0, 500) : ""} />
    </div>
  );
}
