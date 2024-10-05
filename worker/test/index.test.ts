import { Account, Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

import { MODULE_ADDR, NETWORK } from '../src/config';

const aptos = new Aptos(new AptosConfig({ network: NETWORK as Network }));

const alice = Account.generate();
// const bob = Account.generate();

describe('test leofi pump smart contract events', () => {
  beforeAll(async () => {
    await aptos.faucet.fundAccount({
      accountAddress: alice.accountAddress,
      amount: 100_000_000
    });
  });

  test('created event', async () => {
    const publishTx = await aptos.publishPackageTransaction({
      account: alice.accountAddress,
      metadataBytes:
        '0x04636f696e0100000000000000004033453839323536393333344646363841434638333943444144343532413330444144323336454233443638393433433246444646424130434444393138354344b2011f8b08000000000002ff5d8ec10ec2201044ef7c45c3bdb45e4d3c78f1271a0e14d6965458b24bf1f785588df1b6f332333b533276330b68114d80eed2498b3e4a5180d8636ce0a446354a61f6bc22712593166232ce11300337e1a0f47f20417410ad0756d794916f54fb9f489b168bcfad77cd39f17918aa5cf759590c8369cefe61663e4e8b04aa1aa420282d148c8f11aae67d769e1a7a3b031618ee9f2747fcabe531f27797162ff3fe12e4fd00000001057570746f73411f8b08000000000002ff012a00d5ff6d6f64756c6520636f696e3a3a7570746f73207b0a202020207374727563742050554d50207b7d0a7d0a5bfba7fb2a00000000000300000000000000000000000000000000000000000000000000000000000000010e4170746f734672616d65776f726b00000000000000000000000000000000000000000000000000000000000000010b4170746f735374646c696200000000000000000000000000000000000000000000000000000000000000010a4d6f76655374646c696200',
      moduleBytecode: [
        `0xa11ceb0b0600000005010002020204070617081d200a3d05000000010000057570746f730450554d500b64756d6d795f6669656c64${alice.accountAddress.toStringWithoutPrefix()}000201020100`
      ]
    });

    const pendingTransaction = await aptos.signAndSubmitTransaction({
      signer: alice,
      transaction: publishTx
    });

    await aptos.waitForTransaction({
      transactionHash: pendingTransaction.hash
    });

    const tx = await aptos.transaction.build.simple({
      sender: alice.accountAddress,
      data: {
        function: `${MODULE_ADDR}::pump::create`,
        typeArguments: [
          `${alice.accountAddress.toStringWithoutPrefix()}::leofi::PUMP`
        ],
        functionArguments: [
          'name',
          'symbol',
          'uri',
          'description',
          'twitter',
          'telegram',
          'website'
        ]
      }
    });

    const committedTx = await aptos.signAndSubmitTransaction({
      signer: alice,
      transaction: tx
    });

    await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  });

  // test('traded(bought) event', async () => {
  //  const tx = await aptos.transaction.build.simple({
  //    sender: alice.accountAddress,
  //    data: {
  //      function: `${MODULE_ADDR}::pump::buy`,
  //      functionArguments: [alice.accountAddress]
  //    }
  //  });
  //  const committedTx = await aptos.signAndSubmitTransaction({
  //    signer: alice,
  //    transaction: tx
  //  });
  //  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  // });

  // test('traded(sold) event', async () => {
  //  const tx = await aptos.transaction.build.simple({
  //    sender: alice.accountAddress,
  //    data: {
  //      function: `${MODULE_ADDR}::pump::sell`,
  //      functionArguments: [alice.accountAddress]
  //    }
  //  });
  //  const committedTx = await aptos.signAndSubmitTransaction({
  //    signer: alice,
  //    transaction: tx
  //  });
  //  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  // });

  // test('withdrawn event', async () => {
  //  const tx = await aptos.transaction.build.simple({
  //    sender: alice.accountAddress,
  //    data: {
  //      function: `${MODULE_ADDR}::pump::withdraw`,
  //      functionArguments: [alice.accountAddress]
  //    }
  //  });
  //  const committedTx = await aptos.signAndSubmitTransaction({
  //    signer: alice,
  //    transaction: tx
  //  });
  //  await aptos.waitForTransaction({ transactionHash: committedTx.hash });
  // });
});
