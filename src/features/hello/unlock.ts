import {
    CatPsbt,
    MempolChainProvider,
    MempoolUtxoProvider,
    Signer,
} from '@cat-protocol/cat-sdk'
import { HelloCovenant } from '../../covenants/examples/helloCovenant'
import { toByteString, PubKey, UTXO } from 'scrypt-ts'

import { Psbt } from 'bitcoinjs-lib'

export interface UnlockParams {
    signer: Signer
    chainProvider: MempolChainProvider
    utxoProvider: MempoolUtxoProvider
    message: string
    deployedUtxo?: UTXO
}

export async function unlock({
    signer,
    chainProvider,
    utxoProvider,
    message,
    deployedUtxo,
}: UnlockParams) {
    // 获取用户 UTXO
    const userUtxos = await utxoProvider.getUtxos(await signer.getAddress())
    if (userUtxos.length === 0) {
        throw new Error('No UTXOs available')
    }

    const userPubkey = await signer.getPublicKey()

    // 创建合约实例
    const helloCovenant = new HelloCovenant()
    if (deployedUtxo) {
        helloCovenant.bindToUtxo(deployedUtxo)
    }

    // 创建交易
    const psbt = new CatPsbt()
    const feeRate = 2 // 增加费率以满足最小中继费用要求

    psbt.addCovenantInput(helloCovenant)
    psbt.addFeeInputs(userUtxos.slice(0, 1))
    psbt.change(await signer.getAddress(), feeRate)

    const inputCtxs = psbt.calculateInputCtxs()
    const unlockCall = helloCovenant.unlock(
        0,
        Array.from(inputCtxs.values()),
        toByteString(message, true),
        PubKey(userPubkey)
    )[0]
    psbt.updateCovenantInput(0, helloCovenant, unlockCall)

    // 签名交易
    const signedPsbt = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())

    // 广播交易
    const tx = await psbt
        .combine(Psbt.fromHex(signedPsbt))
        .finalizeAllInputsAsync()

    const txId = await chainProvider.broadcast(tx.extractTransaction().toHex())

    return {
        txId,
    }
}
