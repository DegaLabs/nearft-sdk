# NearFT SDK
This repository contains utility Javascript functions to fetch user-owned NFTs and to interact with the NearFT smart contracts

## Install
* With `npm`: npm install --save https://github.com/DegaLabs/nearft-sdk
* With `yarn`: yarn add https://github.com/DegaLabs/nearft-sdk

## Usage
* Contracts: `collectibleswap.testnet` on Near Testnet
* Import: `const NearFT = require('nearft-sdk')` 
* Use `NearFT` to call the following supported functions to interact with the AMM:
    * Function `getPools`: to read the information of all pools from the NearFT contracts of the respective network (testnet or mainnet). Each returned pool contains the following infos:

        * curve_type: the bonding curve used by the pool
        * pool_type: either NFT, Token, or Trading
        * nft_token: the contract ID of the NFTs listed in the pool
        * delta
        * fee
        * owner: the pool owner
        * near_balance: the NEAR liquidity amount
        * pool_token_ids: the list of NFT token IDs available in the pool
        * pool_id
        * accumulated_volume: total accumulated trading volume
        * accumulated_fees: total generated fees

    * Function `getPoolInfo`: to read the details of a single pool
    * Function `getMetadataOfNFT`: to read the metadata of an NFT
    * Function `getNFTData`: to fetch all NFTs owned by an account and all NFTs deposited by the account in the NearFT contract 
    * Function `getListMyCollection`: Return the list of contract IDs of all NFTs owned by an account
    * Function `getBuyInfo`: to compute the amount of Near needed to buy a number of NFTs in the pool
    * Function `getSellInfo`: to compute the amount of Near received when selling a number of NFTs to the pool
    * Function `buyNFT`: the function uses wallet selector to make transactions to buy an NFT from the pool
    * Function `buyMultiNFT`: the function uses wallet selector to make transactions to buy multiple NFTs from the pool
    * Function `sellNFT`: the function uses wallet selector to make transactions to sell one or multiple NFTs to the pool and receive Near
    * Function `createPair`: to make transactions to create a pool and add liquidity to the created pool
    * Function `depositToPool`: to make transactions to deposit more NFTs to NFT pool or deposit more Near token to Token pool
    * Function `addLiquidity`: to deposit both NFTs and Near token to the pool and add liquidity, and the user will receive LP token



