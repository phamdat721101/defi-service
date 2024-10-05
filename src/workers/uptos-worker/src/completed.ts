import { Aptos } from '@aptos-labs/ts-sdk';

import { BATCH_SIZE, MODULE_ADDR } from './config';
import { db, WorkerIdx } from './db';
import { WorkerError } from './error';
import { log } from './logger';

export interface PoolCompletedEvent {
  lp: string;
  token_address: string;
  ts: string;
}

const tokenUpdatedColumns = [
  'completed_tx',
  'completed_at',
  'lp_addr'
] as const;

export const handlePoolCompletedEvent = async (aptos: Aptos) => {
  await db.begin(async tx => {
    const [idx] = await tx<
      WorkerIdx[]
    >`select * from worker_indexes where id = 3`;
    if (!idx) throw new Error('Worker index not found');

    log.info({ idx }, '[PoolCompleted]: processing events');

    const events = await aptos.getEvents({
      options: {
        where: {
          indexed_type: { _eq: `${MODULE_ADDR}::pump::${idx.event}` }
        },
        offset: idx.end_idx,
        limit: BATCH_SIZE,
        orderBy: [{ transaction_version: 'asc' }]
      }
    });

    if (events.length === 0) {
      log.info('[PoolCompleted]: skips as no more events to process');
      return;
    }

    const updatingTokenData = events.map(
      (e: { data: PoolCompletedEvent; transaction_version: string }) => ({
        addr: e.data.token_address,
        completed_tx: e.transaction_version,
        completed_at: Number.parseInt(e.data.ts) / 1000,
        lp_addr: e.data.lp
      })
    );

    const promises: Promise<unknown>[] = updatingTokenData.map(u =>
      tx`update tokens set ${tx(u, tokenUpdatedColumns)} where addr = ${u.addr}`.then(
        ({ count }) => {
          // will retry later
          let result: unknown;
          if (count <= 0)
            throw new WorkerError(
              `[${idx.event}]: Updating token(${u.addr}) not found.`,
              { ignore: true }
            );
          return result;
        }
      )
    );

    const nextIdx = idx.end_idx + BigInt(events.length);

    promises.push(tx`update worker_indexes set
      start_idx = ${idx.end_idx},
      end_idx = ${nextIdx}
      where id = 3`);

    await Promise.all(promises);

    log.info(
      `[PoolCompleted]: completed processing events from ${idx.end_idx.toString()} to ${nextIdx.toString()}`
    );
  });
};
