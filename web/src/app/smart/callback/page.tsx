import type { Metadata } from "next";
import { SmartCallback } from "@/components/smart/smart-flow";

export const metadata: Metadata = { title: "Signing in" };

export default function SmartCallbackPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4">
      <SmartCallback />
    </div>
  );
}
