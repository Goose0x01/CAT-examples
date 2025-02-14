import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    SmartContract,
    toByteString,
} from 'scrypt-ts'

export class Hello extends SmartContract {
    @prop()
    message: ByteString

    constructor() {
        super(...arguments)
        this.message = toByteString('Hello World', true)
    }

    @method()
    public unlock(message: ByteString, pubkey: PubKey) {
        assert(this.message === message)
        assert(pubkey) // 验证公钥不为空
    }
}
