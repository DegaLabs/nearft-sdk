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
    getNFTData: listNFT.getNFTList
}

module.exports = HELP