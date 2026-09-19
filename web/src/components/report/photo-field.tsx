"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downscalePhoto } from "@/lib/photo";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

// Camera or gallery picker. The file input stays native (and keyboard reachable); the label is styled as the button.
export function PhotoField({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await downscalePhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This photo could not be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p id="photo-label" className="text-sm font-medium">
        Photo <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      {value ? (
        <div className="flex items-start gap-3">
          <Image
            src={value}
            alt="Preview of the photo attached to this report"
            width={160}
            height={120}
            unoptimized
            className="h-30 w-40 rounded-lg border object-cover"
          />
          <Button type="button" variant="outline" onClick={() => onChange(null)}>
            <XIcon data-icon="inline-start" />
            Remove photo
          </Button>
        </div>
      ) : (
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pick}
            disabled={busy}
            aria-labelledby="photo-label"
            aria-describedby="photo-hint"
            className="sr-only"
          />
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" aria-hidden /> : <CameraIcon className="size-4" aria-hidden />}
          {busy ? "Preparing photo…" : "Add photo"}
        </label>
      )}
      <p id="photo-hint" className="text-sm text-muted-foreground">
        Please don&apos;t photograph people. Photos are public with your report.
      </p>
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    </div>
  );
}
