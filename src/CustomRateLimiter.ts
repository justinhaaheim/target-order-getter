import {Sema} from 'async-sema';

export type RateLimiterFunction = () => Promise<void>;

export function CustomRateLimiter(
  rps: number,
  {
    timeUnit = 1000,
    uniformDistribution = false,
    shouldLog = false,
  }: {
    shouldLog?: boolean;
    timeUnit?: number;
    uniformDistribution?: boolean;
  } = {},
) {
  const sema = new Sema(uniformDistribution ? 1 : rps);
  const delay = uniformDistribution ? timeUnit / rps : timeUnit;

  let callerIndexTracker = 0;

  return async function rl() {
    const thisCallerIndex = callerIndexTracker;
    callerIndexTracker += 1;

    shouldLog &&
      console.debug(
        `[Caller ${thisCallerIndex}] About to acquire semaphore. Number waiting:`,
        sema.nrWaiting(),
      );
    await sema.acquire();
    shouldLog &&
      console.debug(
        `[Caller ${thisCallerIndex}] Semaphore acquired! Time to do some work. Number waiting:`,
        sema.nrWaiting(),
      );
    setTimeout(() => {
      sema.release();
      shouldLog &&
        console.debug(
          `[Caller ${thisCallerIndex}] Semaphore released. Number waiting:`,
          sema.nrWaiting(),
        );
    }, delay);
  };
}
