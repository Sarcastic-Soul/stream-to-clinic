"use client";

import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small "i" that keeps explanations out of the way: hover or tap it to read more. The page should
 * make sense without opening any of these.
 */
export function InfoTip({ label, children, className, side = "bottom" }: { label: string; children: ReactNode; className?: string; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={label}
        className={cn(
          "inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[popup-open]:bg-sky-100 data-[popup-open]:text-sky-700 dark:data-[popup-open]:bg-sky-950 dark:data-[popup-open]:text-sky-300",
          className,
        )}
      >
        <InfoIcon className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} sideOffset={8} collisionPadding={12} className="z-[100]">
          <Popover.Popup className="max-w-72 origin-[var(--transform-origin)] rounded-xl border bg-popover px-3.5 py-3 text-left text-sm leading-relaxed font-normal tracking-normal text-popover-foreground normal-case shadow-lg transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
