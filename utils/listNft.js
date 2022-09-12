const nearAccount = require('../nearAccount')
const axios = require('axios')
const networkConfig = require('../network')
const nearAPI = require('near-api-js')

async function getInfoNft(networkId, contractTokenId, accountId) {
  try {
    const account = await nearAccount.getReadOnlyAccount(networkId, accountId)
    const contract = new nearAPI.Contract(
      account, // the account object that is connecting
      contractTokenId,
      {
        // name of contract you're connecting to
        viewMethods: ['nft_tokens_for_owner'], // view methods do not change state but usually return a value
        account // account object to initialize and sign transactions.
      }
    )
    const res = await contract.nft_tokens_for_owner({ account_id: accountId })
    return res
  } catch (e) {
    console.error(e.toString())
    return []
  }
}

async function getOwnedNFTMetadata(networkId, contractTokenId, accountId) {
  const arr = []
  try {
    const account = await nearAccount.getReadOnlyAccount(networkId, accountId)
    const nftMetadata = await account.viewFunction({ contractId: contractTokenId, methodName: 'nft_metadata', args: {} })
    nftMetadata.tokenId = contractTokenId
    const contract = new nearAPI.Contract(
      account, // the account object that is connecting
      contractTokenId,
      {
        // name of contract you're connecting to
        viewMethods: ['nft_tokens_for_owner'], // view methods do not change state but usually return a value
        account // account object to initialize and sign transactions.
      }
    )
    const arrayNft = await contract.nft_tokens_for_owner({ account_id: accountId })
    console.log(arrayNft, networkId, contractTokenId, accountId)
    const nft = contractTokenId
    const readTokenMetadata = async (e) => {
      let data = {}
      data = {
        tokenId: e.token_id,
        contractId: nft,
        owner_id: e.owner_id,
        ownerId: e.owner_id,
        nftIcon: nftMetadata.icon
      }
      if (nftMetadata.base_uri) {
        const tokenUri = `${nftMetadata.base_uri}/${e.metadata.reference}`
        console.log('tokenUri', tokenUri)
        let jsonData = await axios.get(tokenUri)
        jsonData = jsonData.data
        console.log('jsonData', jsonData, data.tokenId)
        data.metadata = jsonData
      } else {
        data.metadata = e.metadata
      }
      // data.icon = data.metadata.media
      if (data.metadata.media) {
        data.icon = data.metadata.media
      } else if (data.metadata.animation_url) {
        data.icon = data.metadata.animation_url
      } else if (e.metadata && e.metadata.media) {
        data.icon = `https://cloudflare-ipfs.com/ipfs/${e.metadata.media}`
      }
      const { icon } = data
      if (icon?.includes('data:image/svg+xml,') || icon?.includes('data:image/svg+xml;charset=UTF-8')) {
        let _icon = icon.slice(19)
        data.isSvgXml = true
        data.icon = decodeURIComponent(_icon)
      } else if (icon?.includes('data:image/svg+xml;base64,')) {
        let _icon = icon.slice(26)
        data.icon = atob(_icon)
        data.isSvgXml = true
      } else {
        // data.icon = null
        data.timestamp = Date.now()
      }
      if (!data.metadata.title) {
        data.metadata.title = e.metadata.title
      }
      return data
    }
    promises = []
    for (const e of arrayNft) {
      promises.push(readTokenMetadata(e))
    }
    const data = await Promise.all(promises)
    arr.push(data)
    return arr[0]
  } catch (e) {
    console.error(e)
    return []
  }
}

async function fetchNftList(networkId, address, force = false) {
  let allTokens = []
  try {
    const response = await fetch(
      `${networkConfig[networkId].kitwalletApi}/account/${address}/likelyNFTs`,
      {
        headers: {
          origin: `${networkConfig[networkId].config.walletUrl}`,
          referer: `${networkConfig[networkId].config.walletUrl}`,
        },
      },
    )
    const json = await response.json()
    if (Array.isArray(json)) {
      allTokens = json
    }
  } catch (e) {
    console.error(e.toString())
  }

  return allTokens
}

async function getNFTList(networkId, accountId, contractId = null) {
  let nftPrices = {}
  if (contractId !== null) {
    const readAccount = await nearAccount.getReadOnlyAccount(networkId, contractId)
    let pools = await readAccount.viewFunction({
      contractId: contractId,
      methodName: "get_pools",
      args: {}
    })
    for (let i = 0; i < pools.length; i++) {
      nftPrices[pools[i].nft_token] = pools[i].spot_price
    }
  }

  try {
    const nftList = await fetchNftList(networkId, accountId)
    if (!nftList) {
      return []
    }
    const accountInstance = await nearAccount.getReadOnlyAccount(networkId, accountId)
    const nftMetadataList = {}
    let promises = []
    for (const nft of nftList) {
      promises.push(async function (nft) {
        let nftMetadata = null
        try {
          nftMetadata = await accountInstance.viewFunction({ contractId: nft, methodName: 'nft_metadata', args: {} })
          nftMetadata.tokenId = nft
        } catch (e) {
          nftMetadata = {}
        }
        nftMetadataList[nft] = nftMetadata
      }(nft))
    }
    await Promise.all(promises)
    const arr = []
    for (let i = 0; i < nftList.length; i++) {
      const arrayNft = await getInfoNft(networkId, nftList[i], accountId)
      if (!arrayNft) {
        continue
      }
      const nft = nftList[i]
      const readTokenMetadata = async (e) => {

        let price = ''
        if (nftPrices.hasOwnProperty(nftList[i])) {
          price = nftPrices[nftList[i]]
        }
        let data = {}
        data = {
          tokenId: e.token_id,
          contractId: nftList[i],
          owner_id: e.owner_id,
          ownerId: e.owner_id,
          nftIcon: nftMetadataList[nft].icon,
          price
        }
        if (nftMetadataList[nft].base_uri) {
          const tokenUri = `${nftMetadataList[nft].base_uri}/${e.metadata.reference}`
          let jsonData = await axios.get(tokenUri)
          jsonData = jsonData.data
          data.metadata = jsonData
        } else {
          data.metadata = e.metadata
        }
        // data.icon = data.metadata.media
        if (data.metadata.media) {
          data.icon = data.metadata.media
        } else if (data.metadata.animation_url) {
          data.icon = data.metadata.animation_url
        } else if (e.metadata && e.metadata.media) {
          data.icon = `https://cloudflare-ipfs.com/ipfs/${e.metadata.media}`
        }
        const { icon } = data
        if (icon?.includes('data:image/svg+xml,') || icon?.includes('data:image/svg+xml;charset=UTF-8')) {
          let _icon = icon.slice(19)
          data.isSvgXml = true
          data.icon = decodeURIComponent(_icon)
        } else if (icon?.includes('data:image/svg+xml;base64,')) {
          let _icon = icon.slice(26)
          data.icon = atob(_icon)
          data.isSvgXml = true
        } else {
          // data.icon = null
          data.timestamp = Date.now()
        }
        if (!data.metadata.title) {
          data.metadata.title = e.metadata.title
        }
        return data
      }
      promises = []
      for (const e of arrayNft) {
        promises.push(readTokenMetadata(e))
      }
      const data = await Promise.all(promises)
      arr.push(data)
    }
    arr.sort((a, b) => a.timestamp < b.timestamp)
    return arr
  } catch (e) {
    console.error(e.toString())
  }
  return []
}

module.exports = {
  getNFTList,
  getOwnedNFTMetadata
}
