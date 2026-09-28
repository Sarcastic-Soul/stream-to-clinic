"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseSession, SMART_EVENT, smartSnapshot, type SmartSession } from "@/lib/smart";

function subscribe(listener: () => void) {
  window.addEventListener(SMART_EVENT, listener);
  return () => window.removeEventListener(SMART_EVENT, listener);
}

/** The clinician signed in with SMART on FHIR in this tab, or null. */
export function useSmartSession(): SmartSession | null {
  const raw = useSyncExternalStore(subscribe, smartSnapshot, () => null);
  return useMemo(() => parseSession(raw), [raw]);
}
