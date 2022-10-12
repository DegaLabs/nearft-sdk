module.exports = {
    testnet: {
        explorerNearLink: 'https://explorer.testnet.near.org',
        nearBlocksLink: "https://testnet.nearblocks.io/",
        config: {
            networkId: 'testnet',
            // nodeUrl: 'https://rpctestnet.nearfi.finance',
            nodeUrl: 'https://near-testnet-rpc.allthatnode.com:3030',
            walletUrl: 'https://wallet.testnet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            explorerUrl: 'https://explorer.testnet.near.org',
        },
        kitwalletApi: 'https://testnet-api.kitwallet.app'
    },
    mainnet: {
        explorerNearLink: 'https://explorer.near.org',
        nearBlocksLink: "https://nearblocks.io/",
        config: {
            networkId: "mainnet",
            nodeUrl: "https://rpc.nearfi.finance",
            walletUrl: "https://wallet.mainnet.near.org",
            helperUrl: "https://helper.mainnet.near.org",
            explorerUrl: "https://explorer.mainnet.near.org",
        },
        kitwalletApi: 'https://api.kitwallet.app'
    }
}