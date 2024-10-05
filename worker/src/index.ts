/* eslint-disable unicorn/no-process-exit */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { IMigrator, Migrator } from 'pgroll';

import { handlePoolCompletedEvent } from './completed';
import { NETWORK, TIME_INTERVAL } from './config';
import { handleCreatedTokenEvent } from './created';
import { db } from './db';
import { WorkerError } from './error';
import { initSyncHolderJobs, startSyncHoldersProcess } from './holder';
import { log } from './logger';
// import { handleTradedTokenEvent } from './traded';
import { timeout } from './utils';

const aptos = new Aptos(new AptosConfig({ network: NETWORK as Network }));

const main = async () => {
  const createdEventHandlerTO = Symbol();
  const tradedEventHandlerTO = Symbol();
  const pCompletedEventHandlerTO = Symbol();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await Promise.allSettled([
      timeout(handleCreatedTokenEvent(aptos), 30_000, createdEventHandlerTO),
      // timeout(handleTradedTokenEvent(aptos), 30_000, tradedEventHandlerTO),
      timeout(handlePoolCompletedEvent(aptos), 30_000, pCompletedEventHandlerTO)
    ]).then(results => {
      for (const result of results) {
        if (result.status === 'rejected') {
          switch (result.reason) {
            case createdEventHandlerTO: {
              log.warn('[Worker]: created event handler timeout');
              continue;
            }
            case tradedEventHandlerTO: {
              log.warn('[Worker]: traded event handler timeout');
              continue;
            }
            case pCompletedEventHandlerTO: {
              log.warn('[Worker]: pool completed event handler timeout');
              continue;
            }
            default: {
              break;
            }
          }
          const error = result.reason as WorkerError;
          if (!error.opts?.ignore) {
            log.error({ error }, '[Worker]: unhandle error');
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, TIME_INTERVAL));
  }
};

(new Migrator(db) as IMigrator)
  .up()
  .then(() => {
    //-------------------
    // Main eventhandler
    //-------------------
    // eslint-disable-next-line promise/no-nesting
    main().catch((error: unknown) => {
      log.error({ error }, 'worker exit with error');
      process.exit(1);
    });

    //-------------------
    // Holder synchonizer
    //-------------------
    // eslint-disable-next-line promise/no-nesting
    startSyncHoldersProcess(aptos).catch((error: unknown) => {
      log.error({ error }, 'syncHolders error');
      process.exit(1);
    });

    initSyncHolderJobs();
  })
  .catch((error: unknown) => {
    log.error({ error }, 'migrator error');
    process.exit(1);
  });

const shutdown = () => {
  log.info('worker is shutting down gracefully');
  process.exit(0);
};

process.on('SIGTERM', () => {
  log.info('SIGTERM signal received');
  shutdown();
});

process.on('SIGINT', () => {
  log.info('SIGINT signal received');
  shutdown();
});
