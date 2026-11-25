export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxClients = 10_000,
  ) {}

  consume(client: string): boolean {
    const time = this.now();
    let bucket = this.buckets.get(client);
    if (!bucket || bucket.expiresAt <= time) {
      if (!bucket && this.buckets.size >= this.maxClients) {
        for (const [key, value] of this.buckets) if (value.expiresAt <= time) this.buckets.delete(key);
        if (this.buckets.size >= this.maxClients) return false;
      }
      bucket = { count: 0, expiresAt: time + this.windowMs };
      this.buckets.set(client, bucket);
    }
    if (bucket.count >= this.limit) return false;
    bucket.count++;
    return true;
  }
}
