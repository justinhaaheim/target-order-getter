const projectConfig = {
  requestRateLimiter: {
    // When used with uniformDistribution = true, this will allow 1 request per timeUnit / rps ms
    rps: 1,
    timeUnit: 1500, // ms
  },
  retryAttemptsLimit: 3,
} as const;

export default projectConfig;
