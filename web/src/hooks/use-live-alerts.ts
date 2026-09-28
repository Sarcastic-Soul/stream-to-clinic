"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AlertSummary, LiveStatus } from "@/lib/types";

export interface Arrival {
  alert: AlertSummary;
  /** When the page heard about it (ms since epoch). */
  receivedAt: number;
}

/**
 * Listens for alerts raised for one clinic while the page is open (Server-Sent Events from the API,
 * or the in-browser mock). Arrivals are newest first and reset when the clinic changes.
 */
export function useLiveAlerts(clinicId: string | undefined, onArrival?: (arrival: Arrival) => void) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [state, setState] = useState<{ clinicId?: string; arrivals: Arrival[] }>({ arrivals: [] });
  const callback = useRef(onArrival);
  useEffect(() => {
    callback.current = onArrival;
  });

  useEffect(() => {
    if (!clinicId) return;
    return api.subscribeAlerts(clinicId, {
      onStatus: setStatus,
      onAlert: (alert) => {
        const arrival = { alert, receivedAt: Date.now() };
        setState((prev) => ({
          clinicId,
          arrivals: [arrival, ...(prev.clinicId === clinicId ? prev.arrivals : []).filter((a) => a.alert.id !== alert.id)],
        }));
        callback.current?.(arrival);
      },
    });
  }, [clinicId]);

  return { status: clinicId ? status : ("offline" as const), arrivals: state.clinicId === clinicId ? state.arrivals : [] };
}
