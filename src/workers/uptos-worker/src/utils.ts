const astronautImg = 'QmS6Db1KFVjgdQNMvn32MCPNhdzNxEN7eyW9A2HscS6N2c';
const builderImg = 'Qmc6qfqQm5C2nT8UpVi2fjEzekcfm87aakvhtMRfw7XRTC';
const coolImg = 'QmVcu16LTURQY4DrAi5EfwpL4DA7Lv2xNjt4yH7hEZir5b';
const cowboyImg = 'QmNLhmywEN57CifjKxr31ELTHTStDCHAVgnVVTKBtAHqog';
const nerdImg = 'QmQVR89NXTXjGNxrJF2GA1oU1rbTLdLPdp1MMuXvCRJVBm';
const walletImg = 'QmQHF5V3vDUgsXwMeQrmX6yNqDzBE2JRFGQn9Csbwm7DWi';

const imgs = [astronautImg, builderImg, coolImg, cowboyImg, nerdImg, walletImg];

export const removeDuplicateUser = (users: { addr: string }[]) => [
  ...new Map(
    users.map(({ addr }) => [
      addr,
      {
        addr,
        name: addr.slice(0, 8),
        img: `https://leofi-pump.myfilebase.com/ipfs/${imgs[Math.floor(Math.random() * imgs.length)] ?? ''}`
      }
    ])
  ).values()
];

export const opsStr = (isBuy: boolean) => (isBuy ? '+' : '-');
