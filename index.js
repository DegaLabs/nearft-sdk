const nearAccount = require("./nearAccount")

const HELP = {
    getPools: async (networkId, contractId) => {
        const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
        return await readAccount.viewFunction({
            contractId: contractId,
            methodName: "get_pools",
            args: {
            }
        })
    }
}

module.exports = HELP