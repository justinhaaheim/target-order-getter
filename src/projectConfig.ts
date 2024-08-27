const projectConfig = {
  requestRateLimiter: {
    rps: 1,
    timeUnit: 500, // ms
  },
} as const;

export default projectConfig;
