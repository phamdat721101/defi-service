import axios from 'axios';
import { AptosClient, AptosAccount, Types, HexString } from "aptos";
import { Aptos, AptosConfig, MoveStructId, Network } from '@aptos-labs/ts-sdk';


const WALRUS_API_URL = 'https://api.walrus.site/api/v1/data';
const PUBLISHER_URL = process.env.BASE_PUBLISHER_URL || 'https://publisher-devnet.walrus.space'
const AGGREGATOR_URL = process.env.AGGREGATOR || 'https://aggregator-devnet.walrus.space'

interface WalrusOptions {
  timestamp?: string;
  tags?: string[];
}

const aptos = new Aptos(
    new AptosConfig({ network: 'testnet' as Network })
);

export async function createCapital(data: any): Promise<string> {
    const client = new AptosClient('https://api.testnet.aptoslabs.com/v1');
    const contractAddress = "0xf1a29176e0690487a0d8e10aec8d681935fe678ddc96165800d5f6f2b25b0c6f";
    const privateKey = "0xf29d8be243551671c7949f59538980de229cc62061a95ce1505a790f955068e5"
    const moduleName = "leofi_module"    
    const functionName = "create"
    const account = new AptosAccount(new HexString(privateKey).toUint8Array());
    const addr = account.address()
    const symbol = 'PQD'
    const type = `${addr}::${symbol}::${symbol}`
    
    const payload: Types.TransactionPayload = {
        type: "entry_function_payload",
        function: `${contractAddress}::${moduleName}::${functionName}`,
        type_arguments: [type],
        arguments: [
        "PQD",
        "PQD",
        'ipfs',
        "pn",
        'twitter',
        'telegram',
        'leofy.xy'
        ],          
    };
    
    try {
        console.log("Account address: ", account.address)
        const rawTxn = await client.generateTransaction(account.address(), payload);
        const signedTxn = await client.signTransaction(account, rawTxn);
        const pendingTxn = await client.submitTransaction(signedTxn);
        const txnResult = await client.waitForTransaction(pendingTxn.hash);
    
        return pendingTxn.hash;
    } catch (error) {
        console.log("Error calling Aptos function:", error);
        throw error;
    }
}