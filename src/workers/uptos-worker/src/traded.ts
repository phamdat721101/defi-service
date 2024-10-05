import { Aptos } from '@aptos-labs/ts-sdk';

import { BATCH_SIZE, LEGEND_TARGET_CAP_APTOS, MODULE_ADDR } from './config';
import { db, WorkerIdx } from './db';
import { WorkerError } from './error';
import { log } from './logger';
import { opsStr, removeDuplicateUser } from './utils';

export interface TradedTokenEvent {
  is_buy: boolean;
  user: string;
  token_address: string;
  aptos_amount: string;
  token_amount: string;
  virtual_aptos_reserves: string;
  virtual_token_reserves: string;
  ts: string;
}
export interface Token {
  addr: string;
  nsfw: boolean;
  img: string;
  name: string;
  ticker: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  virtual_aptos_reserves: bigint;
  virtual_token_reserves: bigint;
  initial_token_reserves: bigint;
  rep_c: number;
  created_by: string;
  bonding_curve: string;
  created_at: Date;
  tx_at?: Date;
  tx_c: number;
  rep_at?: Date;
  completed_at?: Date;
  completed_tx?: bigint;
  legend_at?: Date;
  legend_tx?: bigint;
}

export const handleTradedTokenEvent = async (aptos: Aptos) => {
  await db.begin(async tx => {
    const [idx] = await tx<
      WorkerIdx[]
    >`select * from worker_indexes where id = 2`;
    if (!idx) throw new Error('Worker index not found');

    log.info({ idx }, '[Traded]: processing events');

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
      log.info('[Traded]: skips as no more events to process');
      return;
    }

    const updatingTokenData = events.map(
      (e: { data: TradedTokenEvent; transaction_version: string }) => ({
        // not col
        tokenAddr: e.data.token_address,
        holderAddr: e.data.user,
        isBuy: e.data.is_buy,
        tokenAmount: e.data.token_amount,
        txId: e.transaction_version,

        // col
        virtual_aptos_reserves: e.data.virtual_aptos_reserves,
        virtual_token_reserves: e.data.virtual_token_reserves,
        tx_at: Number.parseInt(e.data.ts) / 1000
      })
    );

    const col = [
      'virtual_aptos_reserves',
      'virtual_token_reserves',
      'tx_at'
    ] as const;

    for (const t of updatingTokenData) {
      const updateToken = tx<
        [Token]
      >`update tokens set ${tx(t, col)}, tx_c = tx_c + 1 where addr = ${t.tokenAddr} returning *`.then(
        result => {
          // will retry later
          if ((result.count as number) <= 0)
            throw new WorkerError(
              `[${idx.event}]: Updating token(${t.tokenAddr}) not found.`,
              { ignore: true }
            );
          return result;
        }
      );

      const updateBondingCurve = tx`
        update holders set amount = amount ${tx.unsafe(opsStr(!t.isBuy))} ${t.tokenAmount}
        where token_addr = ${t.tokenAddr} and holder_addr = ${MODULE_ADDR}`;

      const updateHolder = tx`
        insert into holders (token_addr, holder_addr, amount)
        values (${t.tokenAddr}, ${t.holderAddr}, ${t.tokenAmount})
        on conflict (token_addr, holder_addr)
        do update set amount = holders.amount ${tx.unsafe(opsStr(t.isBuy))} excluded.amount`;

      const [[newToken]] = await Promise.all([
        updateToken,
        updateBondingCurve,
        updateHolder
      ]);

      if (
        !newToken.legend_tx &&
        newToken.virtual_aptos_reserves >= LEGEND_TARGET_CAP_APTOS
      ) {
        await tx`update tokens set
legend_at = ${t.tx_at},
legend_tx = ${t.txId}
where addr = ${newToken.addr}`;
      }
    }

    const insertingTradeData = events.map(
      (e: { data: TradedTokenEvent; transaction_version: string }) => ({
        transaction_version: e.transaction_version,
        token_addr: e.data.token_address,
        user_addr: e.data.user,
        is_buy: e.data.is_buy,
        aptos_amount: e.data.aptos_amount,
        token_amount: e.data.token_amount,
        virtual_aptos_reserves: e.data.virtual_aptos_reserves,
        virtual_token_reserves: e.data.virtual_token_reserves,
        ts: Number.parseInt(e.data.ts) / 1000
      })
    );

    const insertingUserData = removeDuplicateUser(
      insertingTradeData.map(i => ({ addr: i.user_addr }))
    );

    const { count: user_c } =
      await tx`insert into users ${tx(insertingUserData)} on conflict (addr) do nothing`;

    const nextIdx = idx.end_idx + BigInt(events.length);

    await Promise.all([
      tx`update counting_metadata set user_c = user_c + ${user_c} where id = 1`,
      tx`insert into trade ${tx(insertingTradeData)}`,
      tx`update worker_indexes set
      start_idx = ${idx.end_idx},
      end_idx = ${nextIdx}
      where id = 2`
    ]);

    log.info(
      `[Traded]: completed processing events from ${idx.end_idx.toString()} to ${nextIdx.toString()}`
    );
  });
};
