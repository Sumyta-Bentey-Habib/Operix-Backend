export interface ApiRateLimitPolicy {
  limit: number;
}

export interface ApiRateLimitResult {
  count: number;
  retryAfter: number;
}
