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

async function checkDepositNft(readAccount, ammContractId, contractToken, accountId, tokenIds) {
    let { transactions, deposits } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)

    deposits = deposits.deposits ? deposits.deposits : {}
    let depositedTokenIds = deposits[contractToken]
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
        receiverId: contractToken,
        actions: depositActions
    }

    transactions.push(depositTransaction)

    return transactions
}
const SDK = {
    getPoolInfo: async (networkId, ammContractId, poolId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        const poolInfo = await readAccount.viewFunction({
            contractId: ammContractId,
            methodName: "get_pool_info",
            args: {
                pool_id: poolId,
            }
        })
        const nftOfPool = await listNFT.getOwnedNFTMetadata(networkId, poolInfo.nft_token, ammContractId)
        nftMetadata = {}
        for (const e of nftOfPool) {
            nftMetadata[e.tokenId] = e
        }
        poolInfo.poolTokenMetadata = nftMetadata

        return poolInfo
    },
    getPools: async (networkId, ammContractId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        const ret = await readAccount.viewFunction({
            contractId: ammContractId,
            methodName: "get_pools",
            args: {
            }
        })
        for (var i = 0; i < ret.length; i++) {
            const nftOfPool = await listNFT.getOwnedNFTMetadata(networkId, ret[i].nft_token, ammContractId)
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
    getListMyCollection: async (networkId, ammContractId, accountId) => {
        let nftList = await listNFT.fetchNftList(networkId, accountId)
        if (!nftList) {
            nftList = []
        }
        let deposits = {}
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, accountId)
        let validList = []
        try {
            let deposits = await readAccount.viewFunction({
                contractId: ammContractId,
                methodName: "get_deposits",
                args: {
                    account_id: accountId,
                }
            })
            deposits = deposits.deposits
            // console.log('deposits', deposits)
            validList = Object.keys(deposits).filter(e => deposits[e].length > 0)
            // console.log('deposits validList', validList)
        } catch (e) {
            console.error(e.toString())
        }

        const promises = []
        const validTokens = {}
        const getTokens = async (nft) => {
            const tokenList = await listNFT.getInfoNft(networkId, nft, accountId)
            if (tokenList.length > 0) {
                validTokens[nft] = true
            }
        }
        for (const nft of nftList) {
            promises.push(getTokens(nft))
        }

        await Promise.all(promises)

        nftContractIdsDepositList = Object.keys(deposits)
        for (const n of validList) {
            validTokens[n] = true
        }
        // console.log('validTokens', validTokens)
        // console.log('validList', validList, accountId)

        return Object.keys(validTokens)
    },
    getBuyInfo: async (networkId, ammContractId, nftContractId, poolId, numItems, pools) => {
        if (poolId === undefined) {
            const pool = pools.find(e => e.nft_token === nftContractId)
            poolId = pool.pool_id
        }
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        const poolInfo = await readAccount.viewFunction({
            contractId: ammContractId,
            methodName: "get_pool_info",
            args: {
                pool_id: poolId,
            }
        })
        const buyInfo = await readAccount.viewFunction({
            contractId: ammContractId,
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
    getSellInfo: async (networkId, ammContractId, nftContractId, poolId, numItems, pools) => {
        if (poolId === undefined) {
            const pool = pools.find(e => e.nft_token === nftContractId)
            poolId = pool.pool_id
        }
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        const poolInfo = await readAccount.viewFunction({
            contractId: ammContractId,
            methodName: "get_pool_info",
            args: {
                pool_id: poolId,
            }
        })
        const buyInfo = await readAccount.viewFunction({
            contractId: ammContractId,
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
        const pool = pools.find(e => e.nft_token === nftContractId)
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

        const buyInfo = await SDK.getBuyInfo(networkId, ammContractId, nftContractId, pool.pool_id, tokenIds.length, pools)
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

    /*
     poolIds = [0, 1, 2]
     nftContracts = [nft1.near, nft2.near, nft3.near]
     tokenIds = [[0, 1, 2], [0, 1, 2], [0, 1, 2]]
     */
    buyMultiNFT: async (networkId, ammContractId, poolIds, nftContracts, tokenIds, slippage, walletSelector, accountId) => {
        if (!Array.isArray(poolIds) || !Array.isArray(nftContracts) || !Array.isArray(tokenIds)) {
            throw "Invalid params. poolIds, nftContracts, tokenIds need is array"
        }
        if (poolIds.length !== nftContracts.length || nftContracts.length !== tokenIds.length) {
            throw "poolIds, nftContracts, tokenIds need have same length"
        }

        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)

        const wallet = await walletSelector.wallet()

        for (let i = 0; i < poolIds.length; i++) {
            const buyInfo = await SDK.getBuyInfo(networkId, ammContractId, nftContracts[i], poolIds[i], tokenIds[i].length, {})
            let inputValue = buyInfo.input_value
            inputValue = new BigNumber(inputValue).multipliedBy(100 + Math.floor(slippage * 100)).dividedBy(100).toFixed(0)
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
                                        pool_id: poolIds[i],
                                        swap_type: 1,
                                        output_token_ids: tokenIds[i],
                                        num_out_nfts: tokenIds[i].length,
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
        }

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
        if (!tokenIds || tokenIds.length === 0) {
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

        const sellInfo = await SDK.getSellInfo(networkId, ammContractId, nftContractId, pool.pool_id, tokenIds.length, pools)
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
    createPair: async (walletSelector, networkId, ammContractId, tokenContract, accountId, poolType, bondingCurve, spotPrice, delta, fee, assetRecipient, initialTokenIds, lookTil, depositAmount) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, tokenContract)
        let { transactions, deposits } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)

        deposits = deposits.deposits ? deposits.deposits : {}
        let depositedTokenIds = deposits[tokenContract]
        if (!depositedTokenIds) {
            depositedTokenIds = []
        }
        // console.log('initialTokenIds', initialTokenIds)
        let tokenIdsToDeposit = initialTokenIds.filter(e => !depositedTokenIds.includes(e))

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
            receiverId: tokenContract,
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
                            pool_type: poolType,
                            bonding_curve: bondingCurve,
                            asset_id: tokenContract,
                            spot_price: spotPrice,
                            delta: delta,
                            fee: fee,
                            asset_recipient: poolType === 2 ? null : assetRecipient,
                            initial_token_ids: initialTokenIds,
                            locked_til: lookTil
                        },
                        gas: 300000000000000,
                        deposit: depositAmount,
                    },
                },
            ],
        })

        return wallet.signAndSendTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to create pair");
                throw err;
            })
    },
    depositToPool: async (walletSelector, networkId, ammContractId, accountId, poolId, tokenIds, depositAmount) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)
        const wallet = await walletSelector.wallet()
        transactions.push({
            signerId: accountId,
            receiverId: ammContractId,
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

        return wallet.signAndSendTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to swap");

                throw err;
            })
    },
    addLiquidity: async (walletSelector, networkId, ammContractId, tokenContract, accountId, poolId, tokenIds, depositAmount) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)

        let transactions = await checkDepositNft(readAccount, ammContractId, tokenContract, accountId, tokenIds)
        const wallet = await walletSelector.wallet()
        transactions.push({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "add_liquidity",
                        args: {
                            pool_id: poolId,
                            token_ids: tokenIds,
                        },
                        gas: 300000000000000,
                        deposit: depositAmount,
                    },
                },
            ],
        })

        return wallet.signAndSendTransactions({
            transactions
        })
            .catch((err) => {
                console.log("Failed to add liquidity");

                throw err;
            })
    },
    withdrawNear: async (walletSelector, networkId, ammContractId, accountId, poolId, nearAmount) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)
        transactions.push({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "withdraw_near",
                        args: {
                            pool_id: poolId,
                            near_amount: nearAmount,
                        },
                        gas: 300000000000000,
                        deposit: '100000000000000000000000',
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
            })
    },
    withdrawNfts: async (walletSelector, networkId, ammContractId, accountId, poolId, tokenIds) => {
        const wallet = await walletSelector.wallet()
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, ammContractId)
        let { transactions } = await checkStorageDepositAndMakeTx(readAccount, ammContractId, accountId)
        transactions.push({
            signerId: accountId,
            receiverId: ammContractId,
            actions: [
                {
                    type: "FunctionCall",
                    params: {
                        methodName: "withdraw_nfts",
                        args: {
                            pool_id: poolId,
                            token_ids: tokenIds,
                        },
                        gas: 300000000000000,
                        deposit: '100000000000000000000000',
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
            })
    },
    isTokenDepositedBy: listNFT.isTokenDepositedBy
}

module.exports = SDK