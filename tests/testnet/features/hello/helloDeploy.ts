import {
    AddressType,
    DefaultSigner,
    MempolChainProvider,
    MempoolUtxoProvider,
    CatPsbt,
} from '@cat-protocol/cat-sdk'
import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import { initEccLib, Psbt } from 'bitcoinjs-lib'
import { Hello } from '../../../../src/contracts/examples/hello'
import { HelloCovenant } from '../../../../src/covenants/examples/helloCovenant'
import * as dotenv from 'dotenv'

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

        // 获取 UTXO
        const userUtxos = await utxoProvider.getUtxos(address)
        if (userUtxos.length == 0) {
            console.log('错误: 没有可用的 UTXO')
            console.log(
                `请从水龙头获取测试币: https://fractal-testnet.unisat.io/explorer/faucet`
            )
            console.log(`你的地址: ${address}`)
            return
        }

        // 部署合约
        console.log('正在部署合约...')
        const helloCovenant = new HelloCovenant()
        const deployPsbt = new CatPsbt()
        const covenantSatoshis = 10000 // 增加合约的 satoshis
        const feeRate = 2 // 增加费率以满足最小中继费用要求

        // 选择足够大的 UTXO
        const totalNeeded = covenantSatoshis + 2000 // 增加预留费用
        const selectedUtxos = userUtxos.filter(
            (utxo) => utxo.satoshis >= totalNeeded
        )
        if (selectedUtxos.length === 0) {
            console.log('错误: 没有足够大的 UTXO')
            console.log(`需要至少 ${totalNeeded} satoshis`)
            return
        }

        // 先添加输入
        deployPsbt.addFeeInputs(selectedUtxos.slice(0, 1))

        // 添加合约输出
        deployPsbt.addCovenantOutput(helloCovenant, covenantSatoshis)

        deployPsbt.change(address, feeRate)

        const signedDeployPsbt = await signer.signPsbt(
            deployPsbt.toHex(),
            deployPsbt.psbtOptions()
        )
        const deployTx = await deployPsbt
            .combine(Psbt.fromHex(signedDeployPsbt))
            .finalizeAllInputsAsync()

        const deployTxId = await chainProvider.broadcast(
            deployTx.extractTransaction().toHex()
        )
        console.log('部署交易ID:', deployTxId)

        // 打印所有输出信息
        console.log('交易输出:')
        for (let i = 0; i < deployTx.txOutputs.length; i++) {
            console.log(`输出 ${i}:`, deployTx.getUtxo(i))
        }

        // 等待部署交易确认
        console.log('等待部署交易确认...')
        let confirmed = false
        for (let i = 0; i < 10; i++) {
            try {
                const tx = await chainProvider.getRawTransaction(deployTxId)
                if (tx) {
                    confirmed = true
                    console.log('部署交易已确认!')
                    break
                }
            } catch (error) {
                process.stdout.write('.')
                await new Promise((resolve) => setTimeout(resolve, 1000))
            }
        }
        if (!confirmed) {
            console.log('\n警告: 部署交易尚未确认，请稍后再试')
            return
        }

        const contractUtxo = deployTx.getUtxo(1)
        console.log('contractUtxo:', contractUtxo)
    } catch (error) {
        console.error('发生错误:', error)
    }
}

main()
