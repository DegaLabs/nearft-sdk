const utils = require('../utils/listNft')
const index = require('../index')
async function main() {
    let nft = await index.getPools("testnet", "nearftamm.testnet")
    console.log(nft)
}

main()