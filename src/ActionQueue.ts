import Queue from 'yocto-queue';

type ActionFunction<T> = () => Promise<T>;

export type ActionQueueItem<T> = {
  action: ActionFunction<T>;
  attemptsLimit: number;
  attemptsMade: number;
  id: string;
};

type ActionQueueConfig = {
  retryAttempts: number;
};

type ActionQueueReturnType<OutputDataType> = {
  actionQueueCompletePromise: Promise<Array<OutputDataType>>;
  enqueueAction: (
    action: ActionFunction<OutputDataType>,
    idSuffix: string,
  ) => void;
  startQueue: () => void;
};

export function getNewActionQueue<OutputDataType>(
  actionQueueConfig: ActionQueueConfig,
): ActionQueueReturnType<OutputDataType> {
  const outputDataArray: Array<OutputDataType> = [];

  const actionQueueCompletePromiseFunctions: {
    reject: ((reason?: any) => void) | null;
    resolve:
      | ((
          value: Array<OutputDataType> | PromiseLike<Array<OutputDataType>>,
        ) => void)
      | null;
  } = {reject: null, resolve: null};
  const actionQueueCompletePromise = new Promise<Array<OutputDataType>>(
    (resolve, reject) => {
      actionQueueCompletePromiseFunctions.resolve = resolve;
      actionQueueCompletePromiseFunctions.reject = reject;
    },
  );

  /**
   * The actionQueue is a queue of functions with no argument
   */
  const actionQueue = new Queue<() => Promise<void>>();

  /**
   * Simply dequeues the next item and adds it to the event loop queue (without awaiting).
   *
   * When the queue is empty it resolves the actionQueueCompletePromise
   */
  const kickoffNextAction = async () => {
    console.debug(
      `[Queue size: ${actionQueue.size}] Kicking off next action...`,
    );
    const a = actionQueue.dequeue();
    if (a != null) {
      a();
    } else {
      if (actionQueueCompletePromiseFunctions.resolve == null) {
        throw new Error(
          'actionQueueCompletePromiseFunctions.resolve is null. it should not be',
        );
      }
      console.debug(
        'No more actions to kick off. Resolving the actionQueueCompletePromise',
      );
      actionQueueCompletePromiseFunctions.resolve(outputDataArray);
    }
  };

  /**
   * This function wraps an individual action items and handles retries
   *
   * @param param0
   * @returns
   */
  const actionQueueWrapperFn = async (
    actionItem: ActionQueueItem<OutputDataType>,
  ): Promise<void> => {
    if (actionItem.attemptsMade >= actionItem.attemptsLimit) {
      console.log(
        `Action ${actionItem.id} has already made ${actionItem.attemptsMade}/${actionItem.attemptsLimit} attempts. Skipping.`,
      );
      return;
    }

    try {
      console.log(
        `🟢 Initiating action ${actionItem.id} (attempt ${
          actionItem.attemptsMade + 1
        }/${actionItem.attemptsLimit})...`,
      );
      const orderData = await actionItem.action();
      console.debug(`Action ${actionItem.id} completed successfully.`);
      outputDataArray.push(orderData);
      console.debug(`Action ${actionItem.id} data pushed.`);
    } catch (error) {
      console.warn(`Action ${actionItem.id} threw the following error:`);
      console.warn(error);

      if (actionItem.attemptsMade + 1 < actionItem.attemptsLimit) {
        // Queue the action to retry right away. Running these actions in their original order may have some advantages in terms of clarity.
        console.debug(`Re-queuing action ${actionItem.id}...`);
        actionQueue.enqueue(async () => {
          // Do not await it here. We just want to add it to the event loop
          return actionQueueWrapperFn({
            ...actionItem,
            attemptsMade: actionItem.attemptsMade + 1,
          });
        });
      }
    } finally {
      kickoffNextAction();
    }
  };

  let actionIDCounter = 0;

  const enqueueAction = (
    action: () => Promise<OutputDataType>,
    idSuffix: string,
  ) => {
    actionQueue.enqueue(async () => {
      return actionQueueWrapperFn({
        action,
        attemptsLimit: actionQueueConfig.retryAttempts,
        attemptsMade: 0,
        id: `action-${actionIDCounter++}--${idSuffix}`,
      });
    });
  };

  return {
    actionQueueCompletePromise,
    enqueueAction: enqueueAction,
    startQueue: kickoffNextAction,
  };
}
