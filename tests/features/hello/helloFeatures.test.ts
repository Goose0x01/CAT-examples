import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
    AddressType,
    DefaultSigner,
    Signer,
    MempolChainProvider,
    MempoolUtxoProvider,
} from '@cat-protocol/cat-sdk'
import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import { initEccLib } from 'bitcoinjs-lib'
import { Hello } from '../../../src/contracts/examples/hello'
import { unlock } from '../../../src/features/hello/unlock'
import * as dotenv from 'dotenv'
use(chaiAsPromised)
dotenv.config()

const ECPair = ECPairFactory(ecc)
initEccLib(ecc)

describe('Test the features for `HelloCovenant`', () => {
    let signer: Signer
    let chainProvider: MempolChainProvider
    let utxoProvider: MempoolUtxoProvider

    before(async () => {
        Hello.loadArtifact()
        chainProvider = new MempolChainProvider('fractal-testnet')
        utxoProvider = new MempoolUtxoProvider('fractal-testnet')

        const wif = process.env.PRIVATE_KEY!
        signer = new DefaultSigner(ECPair.fromWIF(wif), AddressType.P2TR)
    })

    it('should unlock successfully', async () => {
        const message = 'Hello World'

        const result = await unlock({
            signer,
            chainProvider,
            utxoProvider,
            message,
        })

        expect(result.txId).to.be.a('string')
        // 验证交易已经被广播
        const tx = await chainProvider.getRawTransaction(result.txId)
        expect(tx).to.not.be.undefined
    })

    it('should fail with wrong message', async () => {
        const message = 'Wrong Message'

        await expect(
            unlock({
                signer,
                chainProvider,
                utxoProvider,
                message,
            })
        ).to.be.rejectedWith('Assert failed: this.message === message')
    })
})
