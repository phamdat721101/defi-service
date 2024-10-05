import postgres from 'postgres';

export const db = postgres({
  max: 20,
  idle_timeout: 30,
  max_lifetime: 5 * 60,
  connect_timeout: 25,
  onnotice: () => {
    // do nothing
  },
  // debug: (_c, q, p) => {
  //  console.log(q, p);
  // },
  types: {
    bigint: postgres.BigInt
  }
});

export interface WorkerIdx {
  id: number;
  event: string;
  start_idx: bigint;
  end_idx: bigint;
}

// @ts-expect-error BigInt is not supported by JSON.stringify
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};
