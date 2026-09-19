// Remembers ids for a short time. The API uses it to skip Subscription notifications for
// Observations it has just written and already evaluated in POST /reports.
export class RecentIds {
  private readonly expiry = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  add(id: string, now = Date.now()): void {
    for (const [key, until] of this.expiry) if (until <= now) this.expiry.delete(key);
    this.expiry.set(id, now + this.ttlMs);
  }

  has(id: string, now = Date.now()): boolean {
    return (this.expiry.get(id) ?? 0) > now;
  }
}
