const BigNumber = require('bignumber.js')
const nearAccount = require("./nearAccount")
const listNFT = require('./utils/listNft')
const nearAPI = require('near-api-js')
const axios = require('axios')

async function checkStorageDepositAndMakeTx(account, ammContractId, accountId) {
    let transactions = []
    let deposits = {}
    try {
        deposits = await account.viewFunction({
            contractId: ammContractId,
            methodName: "get_deposits",
            args: {
                account_id: accountId,
            }
        })
    } catch (e) {
        // need to register
        let tx = {
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "storage_deposit",
                        args: {},
                        gas: 100000000000000,
                        deposit: "500000000000000000000000"
                    }
                }
            ]
        }
        transactions.push(tx)
    }
    return { transactions, deposits }
}
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
    getMetadataOfNFT: listNFT.getMetadataOfNFT,
    getNFTData: listNFT.getNFTList,
    getListMyCollection: listNFT.fetchNftList,
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
        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds]
        }
        if (!tokenIds || tokenIds.length == 0) {
            throw "Invalid output token Ids"
        }

        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)

        const buyInfo = await SDK.getBuyInfo({ networkId, contractId: ammContractId, poolId: pool.pool_id, numItems: tokenIds.length, pools })
        let inputValue = buyInfo.input_value
        inputValue = new BigNumber(inputValue).multipliedBy(100 + Math.floor(slippage * 100)).dividedBy(100).toFixed(0)
        const wallet = await walletSelector.wallet()
        transactions.push({
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
                                    num_out_nfts: tokenIds.length,
                                    input_token_ids: []
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: inputValue,
                    },
                },
            ],
        })
        return wallet.signAndSendTransactions({
            transactions
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

        if (!Array.isArray(tokenIds)) {
            tokenIds = [tokenIds]
        }
        if (!tokenIds || tokenIds.length == 0) {
            throw "Invalid output token Ids"
        }

        // deposit tokenIds if not deposited yet
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions, deposits } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)

        deposits = deposits.deposits ? deposits.deposits : {}
        let depositedTokenIds = deposits[nftContractId]
        if (!depositedTokenIds) {
            depositedTokenIds = []
        }

        let tokenIdsToDeposit = tokenIds.filter(e => !depositedTokenIds.includes(e))

        let depositActions = []
        for (const tokenId of tokenIdsToDeposit) {
            depositActions.push({
                type: "FunctionCall",
                params: {
                    methodName: "nft_transfer_call",
                    args: {
                        receiver_id: ammContractId,
                        token_id: tokenId,
                        msg: ''
                    },
                    gas: 100000000000000,
                    deposit: "1"
                }
            })
        }
        let depositTransaction = {
            receiverId: nftContractId,
            actions: depositActions
        }

        transactions.push(depositTransaction)

        const sellInfo = await SDK.getSellInfo({ networkId, contractId: ammContractId, poolId: pool.pool_id, numItems: tokenIds.length, pools })
        let outputValue = sellInfo.output_value
        outputValue = new BigNumber(outputValue).multipliedBy(100 - Math.floor(slippage * 100)).dividedBy(100).toFixed(0)
        const wallet = await walletSelector.wallet()
        transactions.push({
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
                                    input_token_ids: tokenIds,
                                    output_token_ids: []
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: "100000000000000000000000",
                    },
                },
            ],
        })
        return wallet.signAndSendTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            });
    },
    createPair: async (walletSelector, networkId, ammContractId, contractId, accountId, poolType, bondingCurve, spotPrice, delta, fee, assetRecipient, initialTokenIds, lookTil, depositAmount) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        let { transactions, deposits } = await checkStorageDepositAndMakeTx(readAccount, contractId, accountId)

        deposits = deposits.deposits ? deposits.deposits : {}
        let depositedTokenIds = deposits[contractId]
        if (!depositedTokenIds) {
            depositedTokenIds = []
        }

        let tokenIdsToDeposit = tokenIds.filter(e => !depositedTokenIds.includes(e))

        let depositActions = []
        for (const tokenId of tokenIdsToDeposit) {
            depositActions.push({
                type: "FunctionCall",
                params: {
                    methodName: "nft_transfer_call",
                    args: {
                        receiver_id: ammContractId,
                        token_id: tokenId,
                        msg: ''
                    },
                    gas: 100000000000000,
                    deposit: "1"
                }
            })
        }
        let depositTransaction = {
            receiverId: contractId,
            actions: depositActions
        }

        transactions.push(depositTransaction)

        transactions.push({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "create_pair",
                        args: {
                            actions: [
                                {
                                    pool_type: poolType,
                                    bonding_curve: bondingCurve,
                                    asset_id: contractId,
                                    spot_price: spotPrice,
                                    delta: delta,
                                    fee: fee,
                                    asset_recipient: assetRecipient,

                                    initial_token_ids: initialTokenIds,
                                    locked_til: lookTil
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: depositAmount,
                    },
                },
            ],
        })

        return wallet.requestSignTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to create pair");
                throw err;
            })
    },
    depositToPool: async (walletSelector, contractId, accountId, poolId, tokenIds, depositAmount) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, contractId, accountId)
        const wallet = await walletSelector.wallet()
        transactions.push({
            signerId: accountId,
            receiverId: contractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "deposit_to_pool",
                        args: {
                            actions: [
                                {
                                    pool_id: poolId,
                                    token_ids: tokenIds,
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: depositAmount,
                    },
                },
            ],
        })

        return wallet.requestSignTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            })
    },
    withdrawNear: async (walletSelector, contractId, accountId, poolId, nearAmount) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, contractId, accountId)
        transactions.push({
            signerId: accountId,
            receiverId: contractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "withdraw_near",
                        args: {
                            actions: [
                                {
                                    pool_id: poolId,
                                    near_amount: nearAmount,
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: '100000000000000000000000',
                    },
                },
            ],
        })

        return wallet.requestSignTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            })
    },
    withdrawNfts: async (walletSelector, contractId, accountId, poolId, tokenIds) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, contractId, accountId)
        transactions.push({
            signerId: accountId,
            receiverId: contractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "withdraw_nfts",
                        args: {
                            actions: [
                                {
                                    pool_id: poolId,
                                    token_ids: tokenIds,
                                }
                            ]
                        },
                        gas: 300000000000000,
                        deposit: '100000000000000000000000',
                    },
                },
            ],
        })

        return wallet.requestSignTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            })
    },
    isTokenDepositedBy: listNFT.isTokenDepositedBy
}

module.exports = SDK