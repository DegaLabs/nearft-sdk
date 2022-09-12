const utils = require('../utils/listNft')

async function main() {
    let nft = await utils.getNFTList("testnet", "testcreate1.testnet")
    console.log(nft)
}

main()