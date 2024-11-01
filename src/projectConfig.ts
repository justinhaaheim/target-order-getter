const projectConfig = {
  requestRateLimiter: {
    rps: 1,
    timeUnit: 2500, // ms
  },
  retryAttemptsLimit: 3,
} as const;

export default projectConfig;
