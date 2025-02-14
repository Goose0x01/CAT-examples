import { Hello } from '../../contracts/examples/hello'
import {
    Covenant,
    SupportedNetwork,
    InputContext,
    SubContractCall,
} from '@cat-protocol/cat-sdk'
import { ByteString, PubKey } from 'scrypt-ts'

export class HelloCovenant extends Covenant {
    static readonly LOCKED_ASM_VERSION = '2f02d6e4b41b74e92ffcb40fc757eba8'

    constructor(network?: SupportedNetwork) {
        super(
            [
                {
                    contract: new Hello(),
                },
            ],
            {
                lockedAsmVersion: HelloCovenant.LOCKED_ASM_VERSION,
                network,
            }
        )
    }

    serializedState(): ByteString {
        return ''
    }

    unlock(
        index: number,
        inputCtxs: InputContext[],
        message: ByteString,
        userPubKey: PubKey
    ): SubContractCall[] {
        return [
            {
                method: 'unlock',
                argsBuilder: () => [message, userPubKey],
            },
        ]
    }
}
