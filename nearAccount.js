const nearAPI = require('near-api-js')
const networkConfig = require('./network')

const { keyStores, connect, KeyPair } = nearAPI

async function getReadOnlyAccount(networkId, accountId) {
    const config = networkConfig[networkId].config
    const near = await connect(config)
    return  await near.account(accountId)
}
module.exports = {
    getReadOnlyAccount
} 
