import { Aptos } from '@aptos-labs/ts-sdk';
import { TransactionSql } from 'postgres';

import { MODULE_ADDR } from './config';
import { db } from './db';
import { log } from './logger';

const BATCH_SIZE = 100;

interface UserBalance {
  amount: bigint;
  owner_address: string;
}

const queryBuilder = ({
  tokenAddr,
  offset
}: {
  tokenAddr: string;
  offset: number;
}) => `query MyQuery {
  current_coin_balances(
    where: {coin_type: {_eq: "${tokenAddr}"}, _and: {amount: {_gt: 0}}}
    order_by: {amount: desc}
    limit: ${BATCH_SIZE.toString()},
    offset: ${offset.toString()}
  ) {
    amount
    owner_address
  }
}`;

export const syncHolder = async (
  aptos: Aptos,
  tx: TransactionSql<{ bigint: bigint }>,
  token_addr: string
): Promise<void> => {
  log.info({ token_addr }, '[Sync Holder]: holder job starting.');

  const balances: UserBalance[] = [];
  let offset = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      const { current_coin_balances: result } = await aptos.queryIndexer<{
        current_coin_balances: UserBalance[];
      }>({
        query: {
          query: queryBuilder({ tokenAddr: token_addr, offset })
        }
      });

      if (result.length === 0) break;

      offset += result.length;
      balances.push(...result);
    } catch (error: unknown) {
      log.error({ error }, '[Sync Holder]: query indexer error, retry again.');
      continue;
    }
  }

  // delete non-holders
  await tx`update holders set amount = 0
where token_addr = ${token_addr}
and holder_addr not in ${tx([MODULE_ADDR, ...balances.map(b => b.owner_address)])}`;

  if (balances.length > 0) {
    const insertingHolderData = balances.map(b => ({
      token_addr,
      holder_addr: b.owner_address,
      amount: b.amount
    }));
    await tx`insert into holders ${tx(insertingHolderData)}
on conflict(token_addr, holder_addr)
do update set amount = excluded.amount`;
  }

  // mark completed
  await tx`delete from worker_holders where token_addr = ${token_addr}`;
  log.info({ token_addr }, '[Sync Holder]: holder job completed.');
};

export const startSyncHoldersProcess = async (aptos: Aptos) => {
  await initJob();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    // get job
    const jobs = await db<
      { token_addr: string }[]
    >`select token_addr from worker_holders
left join tokens on tokens.addr = worker_holders.token_addr
where tokens.completed_at is null
order by worker_holders.created_at asc limit 2 offset 0`;

    // wait 5s and then skip, if there are no jobs to run
    if (jobs.length === 0) {
      log.debug('[Sync Holder]: holder jobs not found.');
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    // sync
    await Promise.allSettled(
      jobs.map(job => db.begin(tx => syncHolder(aptos, tx, job.token_addr)))
    );
  }
};

export const initSyncHolderJobs = () => {
  setInterval(
    () => {
      void initJob();
    },
    1000 * 60 * 60 * 2 // 2 hrs
  );
};

const initJob = async (): Promise<void> => {
  log.info('[Sync Holder]: start holder jobs.');
  await db`insert into worker_holders
select addr from tokens
where completed_at is null
on conflict(token_addr) do nothing`;
  log.info('[Sync Holder]: holder jobs initialized.');
};
