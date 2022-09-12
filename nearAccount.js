import * as nearAPI from 'near-api-js'
import networkConfig from './network'

const { keyStores, connect, KeyPair } = nearAPI

async function getReadOnlyAccount(networkId, accountId) {
    const config = networkConfig[networkId]
    const near = await connect(config)
    const account = await near.account(accountId)
    return account
}
module.exports = {
    getReadOnlyAccount
} 
