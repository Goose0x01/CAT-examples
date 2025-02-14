import {
    AddressType,
    DefaultSigner,
    MempolChainProvider,
    MempoolUtxoProvider,
} from '@cat-protocol/cat-sdk'
import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import { initEccLib } from 'bitcoinjs-lib'
import { unlock } from '../../../../src/features/hello/unlock'
import { Hello } from '../../../../src/contracts/examples/hello'
import * as dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()
const ECPair = ECPairFactory(ecc)
initEccLib(ecc)

const main = async function () {
    try {
        // 检查环境变量
        const wif = process.env.PRIVATE_KEY
        if (!wif) {
            console.error('错误: 请在 .env 文件中设置 PRIVATE_KEY')
            return
        }

        // 初始化合约和签名者
        console.log('正在初始化...')
        Hello.loadArtifact()
        const signer = new DefaultSigner(ECPair.fromWIF(wif), AddressType.P2TR)
        const address = await signer.getAddress()
        console.log('地址:', address)

        // 初始化提供者
        const chainProvider = new MempolChainProvider('fractal-testnet')
        const utxoProvider = new MempoolUtxoProvider('fractal-testnet')

        // 执行解锁操作
        console.log('正在执行解锁操作...')
        const message = 'Hello World'
        console.log('使用消息:', message)

        // 获取链上的合约交易
        const txId =
            '4623813cd131748a7ff5353bd0fde3710e982066b8699dc5574d31f9cb1a3e8e'
        const response = await axios.get(
            `https://mempool-testnet.fractalbitcoin.io/api/tx/${txId}`
        )
        const contractTx = response.data
        if (!contractTx) {
            throw new Error('Can not find contract tx')
        }
        console.log('交易输出:')
        contractTx.vout.forEach((vout, index) => {
            console.log(`输出 ${index}:`)
            console.log('  金额:', vout.value)
            console.log('  地址:', vout.scriptpubkey_address)
            console.log('  脚本:', vout.scriptpubkey)
            console.log('  类型:', vout.scriptpubkey_type)
        })

        const contractUtxo = {
            txId: contractTx.txid,
            outputIndex: 1,
            script: contractTx.vout[1].scriptpubkey,
            satoshis: contractTx.vout[1].value,
        }
        console.log('使用的合约 UTXO:', contractUtxo)

        // 检查用户的 UTXO
        const userUtxos = await utxoProvider.getUtxos(address)
        console.log('用户的 UTXO:', userUtxos)
        if (userUtxos.length === 0) {
            throw new Error('用户没有可用的 UTXO')
        }

        const result = await unlock({
            signer,
            chainProvider,
            utxoProvider,
            message,
            deployedUtxo: contractUtxo,
        })

        // 输出结果
        console.log('交易已广播!')
        console.log('交易ID:', result.txId)
        console.log(
            '交易链接:',
            `https://fractal-testnet.unisat.io/explorer/tx/${result.txId}`
        )

        // 等待交易确认
        console.log('正在等待交易确认...')
        let confirmed = false
        for (let i = 0; i < 10; i++) {
            try {
                const tx = await chainProvider.getRawTransaction(result.txId)
                if (tx) {
                    confirmed = true
                    console.log('交易已确认!')
                    break
                }
            } catch (error) {
                process.stdout.write('.')
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
        }
        if (!confirmed) {
            console.log('\n警告: 交易尚未确认，请稍后在浏览器中查看')
        }
    } catch (error) {
        console.error('发生错误:', error)
    }
}

main()
