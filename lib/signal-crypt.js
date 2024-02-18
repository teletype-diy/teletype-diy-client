const crypto = require('crypto');

// const { Buffer } = require('node:buffer');

module.exports =
class SignalCrypt {
    constructor(secret, iv) {
        // this.key = crypto.createSecretKey(secret);
        // this.key = (Buffer.from(secret.replaceAll('-', ''), 'hex')).toString('base64url');
        this.key = secret.replaceAll('-', '');
        console.log(`secret key: ${this.key}`);
        console.log(`as buffer: ${this.convertHexToArrayBuffer(this.key)}`);
        console.log(`as buffer len: ${this.convertHexToArrayBuffer(this.key).byteLength}`);
        this.key = this.convertHexToArrayBuffer(this.key);
        this.iv = null;
        this.setIV(iv);

        // this.algorithm = 'aes-128-gcm';
        // this.algorithm = 'aes-256-gcm';
        this.algorithm = 'aes-128-ctr';
    }

    setIV(iv) {
        // TODO: clean this up, or at least make it explicit.
        // This is a dirty hack. If it was not set initially,
        // we are the host and iv needs fixing
        // else we join the portal and iv was already correct.
        // I think, I say this pattern used elsewhere in the code.
        // That is not an excuse, just an explanation.
        if (!this.iv && iv) {
            this.iv = iv;
        }
    }

    convertHexToArrayBuffer (hex) {
        const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(
            (h) => parseInt(h, 16)
        ));
        return typedArray;
    }

    encrypt (signal) {
        console.log(`trying to encrypt using ${this.key} len ${this.key.length}`);
        console.log(`iv: ${this.iv}`);
        // TODO: fix dirty iv hack
        this.iv = this.iv.substring(0, 16)
        console.log(`iv: ${this.iv}`);
        const encryptCipher = crypto.createCipheriv(this.algorithm, this.key, this.iv)

        const json_signal = JSON.stringify(signal)
        console.log(json_signal);

        let encryptedSignal = encryptCipher.update(json_signal, 'utf8', 'base64');
        encryptedSignal += encryptCipher.final('base64');

        console.log();
        return encryptedSignal;
    }

    decrypt (encryptedSignal) {

        console.log(encryptedSignal);
        console.log(`trying to decrypt using ${this.key} len ${this.key.length}`);

        // TODO: fix dirty iv hack
        this.iv = this.iv.substring(0, 16)
        console.log(`iv: ${this.iv}`);
        const decryptCipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv)

        let signal = decryptCipher.update(encryptedSignal, 'base64', 'utf8');
        signal += decryptCipher.final('utf8');

        console.log(signal);

        signal = JSON.parse(signal);
        // console.log(signal);

        return signal;
    }
}
