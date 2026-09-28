import type { Metadata } from "next";
import { AskAgent } from "@/components/ask/ask-agent";

export const metadata: Metadata = { title: "Ask the data" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  return (
    // The heading lives in AskAgent, a client component, so it follows the chosen language.
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <AskAgent initialQuestion={typeof q === "string" ? q.slice(0, 500) : ""} />
    </div>
  );
}
