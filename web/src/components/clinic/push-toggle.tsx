"use client";

import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon, BellRingIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { readStored, writeStored } from "@/lib/storage";

const PUSH_CLINIC_KEY = "stream-to-clinic.push-clinic";

type State =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "off" }
  | { kind: "on"; endpoint: string; otherClinic: boolean }
  | { kind: "denied" };

// The VAPID key arrives as base64url; PushManager wants the raw bytes.
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// The service worker is registered by Serwist in production builds only; give up after a few seconds.
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return undefined;
  return Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 4000))]);
}

/**
 * Turns web push on for this device and clinic, so an installed clinic app is told about new alerts
 * even while it is closed. Open pages do not need it: they get alerts live anyway.
 */
export function PushToggle({ clinicId }: { clinicId: string }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const reg = await registration();
      if (!reg) return { kind: "unsupported", reason: "This browser cannot receive push notifications here." } as const;
      try {
        await api.getPushKey();
      } catch {
        return { kind: "unsupported", reason: "Push notifications are not available on this server." } as const;
      }
      if (Notification.permission === "denied") return { kind: "denied" } as const;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return { kind: "off" } as const;
      return { kind: "on", endpoint: sub.endpoint, otherClinic: readStored(PUSH_CLINIC_KEY) !== clinicId } as const;
    })().then((next) => active && setState(next));
    return () => {
      active = false;
    };
  }, [clinicId]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await registration();
      if (!reg) return;
      if ((await Notification.requestPermission()) !== "granted") return setState({ kind: "denied" });
      const { publicKey } = await api.getPushKey();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const json = sub.toJSON();
      await api.subscribePush(clinicId, { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } });
      writeStored(PUSH_CLINIC_KEY, clinicId);
      setState({ kind: "on", endpoint: sub.endpoint, otherClinic: false });
      setMessage("Notifications are on. New alerts for this clinic will reach this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState({ kind: "off" });
    } finally {
      setBusy(false);
    }
  }

  async function test(endpoint: string) {
    setBusy(true);
    setMessage(null);
    try {
      await api.testPush(endpoint);
      setMessage("Test sent. It should appear in a few seconds.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The test could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "checking" || state.kind === "unsupported") {
    return state.kind === "unsupported" ? <p className="text-xs text-muted-foreground">{state.reason} Open alerts still arrive live on this page.</p> : null;
  }

  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {state.kind === "on" && !state.otherClinic ? (
          <>
            <BellRingIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-sm font-medium">Notifications on for this clinic</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => test(state.endpoint)}>
                Send a test
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={turnOff}>
                <BellOffIcon data-icon="inline-start" />
                Turn off
              </Button>
            </div>
          </>
        ) : state.kind === "denied" ? (
          <span className="text-sm text-muted-foreground">Notifications are blocked for this site in the browser settings.</span>
        ) : (
          <>
            <BellIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm">
              {state.kind === "on" ? "This device gets notifications for another clinic." : "Get alerts on this device, even with the app closed."}
            </span>
            <Button size="sm" className="ml-auto" disabled={busy} onClick={turnOn}>
              {busy && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
              {state.kind === "on" ? "Switch to this clinic" : "Turn on notifications"}
            </Button>
          </>
        )}
      </div>
      {message && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
