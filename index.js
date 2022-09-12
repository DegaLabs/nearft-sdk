const nearAccount = require("./nearAccount")

const HELP = {
    getPools: async (networkId, contractId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
    }
}

module.exports = HELP