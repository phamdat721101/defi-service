export const TIME_INTERVAL = (1 / 2) * 1000; // 0.5 second

export const LEGEND_TARGET_CAP_APTOS = BigInt(
  process.env['LEGEND_TARGET_CAP_APTOS'] ?? 100_000_000_000
); // 700 + 300 virtual reserves

// enum Network {
//  MAINNET = 'mainnet',
//  TESTNET = 'testnet',
//  DEVNET = 'devnet',
//  LOCAL = 'local',
//  CUSTOM = 'custom'
// }
export const NETWORK = process.env['NETWORK'] ?? 'testnet';

const { MODULE_ADDR = '' } = process.env; // should fail if not provided
if (!MODULE_ADDR) throw new Error('MODULE_ADDR not provided');
export { MODULE_ADDR };

export const BATCH_SIZE = 1000;
