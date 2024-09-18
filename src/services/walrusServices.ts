import axios from 'axios';

const WALRUS_API_URL = 'https://api.walrus.site/api/v1/data';
const PUBLISHER_URL = process.env.BASE_PUBLISHER_URL || 'https://publisher-devnet.walrus.space'
const AGGREGATOR_URL = process.env.AGGREGATOR || 'https://aggregator-devnet.walrus.space'

interface WalrusOptions {
  timestamp?: string;
  tags?: string[];
}

export async function uploadDataToWalrus(imageData: any, options: WalrusOptions = {}) {
  console.log("ENV: ", process.env.WALRUS_API_KEY)

  try {
    const response = await axios.put(PUBLISHER_URL + '/v1/store', {
      data: imageData,
      ...options
    }, {
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': `Bearer ${process.env.WALRUS_API_KEY}`
      }
    });
    console.log("Res upload: ", response)
    return response.data;
  } catch (error) {
    console.error('Error uploading data to Walrus:', error);
    throw error;
  }
}

export async function getDataFromWalrus(data: any, options: WalrusOptions = {}) {
  console.log("Getting Walrus Data")

  try {
    const response = await axios.get(AGGREGATOR_URL + `/v1/${data}`,{
      params: options,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("Walrus data: ", response)
    return response.data;
  } catch (error) {
    console.error('Error getting data to Walrus:', error);
    throw error;
  }
}

