const BigNumber = require('bignumber.js')
const nearAccount = require("./nearAccount")
const listNFT = require('./utils/listNft')
const SDK = {
    getPools: async (networkId, contractId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        const ret = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_pools",
            args: {
            }
        })
        for (var i = 0; i < ret.length; i++) {
            const nftOfPool = await listNFT.getOwnedNFTMetadata(networkId, ret[i].nft_token, contractId)
            nftMetadata = {}
            for (const e of nftOfPool) {
                nftMetadata[e.tokenId] = e
            }
            ret[i].poolTokenMetadata = nftMetadata
        }
        return ret
    },
    getNFTData: listNFT.getNFTList,
    getBuyInfo: async ({ networkId, contractId, poolId, numItems, pools }) => {
        if (poolId === undefined) {
            const pool = pools.find(e => e.nft_token == nftContractId)
            poolId = pool.pool_id
        }
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        const poolInfo = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_pool_info",
            args: {
                pool_id: poolId,
            }
        })
        const buyInfo = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_buy_info",
            args: {
                pool_id: poolId,
                num_items: numItems
            }
        })
        buyInfo.spot_price = poolInfo.spot_price
        buyInfo.price_impact = new BigNumber(buyInfo.new_spot_price)
            .minus(poolInfo.spot_price).div(poolInfo.spot_price).multipliedBy(100).toNumber()
        if (poolInfo.pool_token_ids.length < numItems) {
            buyInfo.error_code = 'error'
        }
        return buyInfo
    },
    getSellInfo: async ({ networkId, contractId, poolId, numItems, pools }) => {
        if (poolId === undefined) {
            const pool = pools.find(e => e.nft_token == nftContractId)
            poolId = pool.pool_id
        }
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        const poolInfo = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_pool_info",
            args: {
                pool_id: poolId,
            }
        })
        const buyInfo = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_sell_info",
            args: {
                pool_id: poolId,
                num_items: numItems
            }
        })
        buyInfo.spot_price = poolInfo.spot_price
        buyInfo.price_impact = new BigNumber(poolInfo.spot_price)
            .minus(buyInfo.new_spot_price).div(poolInfo.spot_price).multipliedBy(100).toNumber()
        if (poolInfo.pool_token_ids.length < numItems) {
            buyInfo.error_code = 'error'
        }
        return buyInfo
    },
    buyNFT: async (networkId, ammContractId, pools, nftContractId, tokenIds, slippage, walletSelector, accountId) => {
        const pool = pools.find(e => e.nft_token == nftContractId)
        if (!pool) {
            throw "No NFT to buy"
        }
        if (!tokenIds || tokenIds.length == 0) {
            throw "Invalid output token Ids"
        }
        const buyInfo = await SDK.getBuyInfo({ networkId, contractId: ammContractId, poolId: pool.pool_id, numItems: tokenIds.length, pools })
        let inputValue = buyInfo.input_value
        inputValue = new BigNumber(inputValue).multipliedBy(100 + Math.floor(slippage * 100)).dividedBy(100).toString()
        const wallet = await walletSelector.wallet()
        return wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "swap",
                        args: {
                            actions: [
                                {
                                    pool_id: pool.pool_id,
                                    swap_type: 1,
                                    output_token_ids: tokenIds,
                                    num_out_nfts: tokenIds.length
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: inputValue,
                    },
                },
            ],
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            });
    },
    sellNFT: async (networkId, ammContractId, pools, nftContractId, tokenIds, slippage, walletSelector, accountId) => {
        const pool = pools.find(e => e.nft_token == nftContractId)
        if (!pool) {
            throw "No pool to sell"
        }
        if (!tokenIds || tokenIds.length == 0) {
            throw "Invalid output token Ids"
        }
        const sellInfo = await SDK.getSellInfo({ networkId, contractId: ammContractId, poolId: pool.pool_id, numItems: tokenIds.length, pools })
        let outputValue = sellInfo.output_value
        outputValue = new BigNumber(inputValue).multipliedBy(100 - Math.floor(slippage * 100)).dividedBy(100).toString()
        const wallet = await walletSelector.wallet()
        return wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "swap",
                        args: {
                            actions: [
                                {
                                    pool_id: pool.pool_id,
                                    swap_type: 0,
                                    min_output_near: outputValue,
                                    input_token_ids: tokenIds
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: "100000000000000000000000",
                    },
                },
            ],
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            });
    }
}

module.exports = SDK