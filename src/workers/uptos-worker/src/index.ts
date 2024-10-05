/* eslint-disable unicorn/no-process-exit */
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { IMigrator, Migrator } from 'pgroll';

// import { handlePoolCompletedEvent } from './completed';
import { NETWORK, TIME_INTERVAL } from './config';
import { handleCreatedTokenEvent } from './created';
import { db } from './db';
import { WorkerError } from './error';
import { log } from './logger';
// import { handleTradedTokenEvent } from './traded';

const aptos = new Aptos(new AptosConfig({ network: NETWORK as Network }));

const main = async () => {
  const migrator: IMigrator = new Migrator(db);
  await migrator.up();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await Promise.allSettled([
      handleCreatedTokenEvent(aptos),
      // handleTradedTokenEvent(aptos),
      // handlePoolCompletedEvent(aptos)
    ]).then(results => {
      for (const result of results) {
        if (result.status === 'rejected') {
          const error = result.reason as WorkerError;
          if (!error.opts?.ignore) {
            log.error({ error }, 'worker error');
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, TIME_INTERVAL));
  }
};

main().catch((error: unknown) => {
  log.error({ error }, 'worker exit with error');
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
