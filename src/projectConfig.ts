const projectConfig = {
  requestRateLimiter: {
    rps: 1,
    timeUnit: 2500, // ms
  },
} as const;

export default projectConfig;
