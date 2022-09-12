const BigNumber = require('bignumber.js')
const nearAccount = require("./nearAccount")
const listNFT = require('./utils/listNft')
const HELP = {
    getPools: async (networkId, contractId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        const ret = await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_pools",
            args: {
            }
        })
        for(var i = 0; i < ret.length; i++) {
            const nftOfPool = await listNFT.getOwnedNFTMetadata(networkId, ret[i].nft_token, contractId)
            nftMetadata = {}
            for(const e of nftOfPool) {
                nftMetadata[e.tokenId] = e
            }
            ret[i].poolTokenMetadata = nftMetadata
        }
        return ret
    },
    getNFTData: listNFT.getNFTList,
    getBuyInfo: async (networkId, contractId, poolId, numItems) => {
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
    getSellInfo: async (networkId, contractId, poolId, numItems) => {
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
    }
}

module.exports = HELP