import { Aptos } from '@aptos-labs/ts-sdk';

import { BATCH_SIZE, MODULE_ADDR } from './config';
import { db, WorkerIdx } from './db';
import { log } from './logger';
import { removeDuplicateUser } from './utils';

export interface CreatedTokenEvent {
  name: string;
  symbol: string;
  uri: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  token_address: string;
  bonding_curve: string;
  created_by: string;
  virtual_aptos_reserves: string;
  virtual_token_reserves: string;
  ts: string;
}

export const handleCreatedTokenEvent = async (aptos: Aptos): Promise<void> => {
  console.log("Starting monitor created event")
  await db.begin(async tx => {
    const [idx] = await tx<
      WorkerIdx[]
    >`select * from worker_indexes where id = 1`;
    if (!idx) throw new Error('Worker index not found');

    log.debug({ idx }, '[Created]: processing events');

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

    if (events.length === 0 || events === undefined) {
      log.debug('[Created]: skips as no more events to process');
      return;
    }

    const insertingTokenData = events.map((e: { data: CreatedTokenEvent }) => ({
      name: e.data.name,
      ticker: e.data.symbol,
      img: e.data.uri,
      description: e.data.description,
      twitter: e.data.twitter,
      telegram: e.data.telegram,
      website: e.data.website,
      addr: e.data.token_address,
      bonding_curve: e.data.bonding_curve,
      created_by: e.data.created_by,
      virtual_aptos_reserves: e.data.virtual_aptos_reserves,
      virtual_token_reserves: e.data.virtual_token_reserves,
      initial_token_reserves: e.data.virtual_token_reserves,
      created_at: Number.parseInt(e.data.ts) / 1000
    }));

    console.log("Token created data: ", insertingTokenData)

    const insertingUserData = removeDuplicateUser(
      insertingTokenData.map(i => ({ addr: i.created_by }))
    );

    const insertingHolderData = insertingTokenData.map(i => ({
      token_addr: i.addr,
      holder_addr: MODULE_ADDR,
      amount: i.virtual_token_reserves
    }));

    const { count: user_c } =
      await tx`insert into users ${tx(insertingUserData)} on conflict (addr) do nothing`;

    const nextIdx = idx.end_idx + BigInt(events.length);

    await Promise.all([
      tx`insert into tokens ${tx(insertingTokenData)}`.then(
        ({ count: token_c }) =>
          tx`update counting_metadata set user_c = user_c + ${user_c}, token_c = token_c + ${token_c} where id = 1`
      ),
      tx`insert into holders ${tx(insertingHolderData)}`,
      tx`update worker_indexes set
      start_idx = ${idx.end_idx},
      end_idx = ${nextIdx}
      where id = 1`,
      tx.notify('sync_for', 'created')
    ]);

    log.info(
      `[Created]: completed processing events from ${idx.end_idx.toString()} to ${nextIdx.toString()}`
    );
  });
};
