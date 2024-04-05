const crypto = require('crypto');
const zlib = require('zlib');

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

    setIV(hostPeerId) {
        // TODO: clean this up, or at least make it explicit.
        // This is a dirty hack. If it was not set initially,
        // we are the host and iv needs fixing
        // else we join the portal and iv was already correct.
        // I think, I say this pattern used elsewhere in the code.
        // That is not an excuse, just an explanation.
        if (!this.iv && hostPeerId) {
            const ivHashArray = crypto.createHash('sha256').update(hostPeerId).digest().slice(0,16);
            console.log(`iv hash length: ${ivHashArray.byteLength}`);
            this.iv = ivHashArray;
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
        console.log(`iv: 0x${this.iv.toString('hex')}`);
        const encryptCipher = crypto.createCipheriv(this.algorithm, this.key, this.iv)

        const json_signal = JSON.stringify(signal)
        console.log(json_signal);

        let encryptedSignal = encryptCipher.update(json_signal, 'utf8', 'base64');
        encryptedSignal += encryptCipher.final('base64');

        console.log();
        return encryptedSignal;
    }

    encryptCompress(signal) {
        const compressedSignal = zlib.brotliCompressSync(signal);

        const encryptCipher = crypto.createCipheriv(this.algorithm, this.key, this.iv)

        // input encording is ignored if input is buffer...
        // yeah, go figure..
        let encryptedSignal = encryptCipher.update(compressedSignal, 'invalid', 'base64');
        encryptedSignal += encryptCipher.final('base64');

        return encryptedSignal;
    }

    decrypt (encryptedSignal) {

        console.log(encryptedSignal);
        console.log(`trying to decrypt using ${this.key} len ${this.key.length}`);
        console.log(`iv: 0x${this.iv.toString('hex')}`);
        const decryptCipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv)

        let signal = decryptCipher.update(encryptedSignal, 'base64', 'utf8');
        signal += decryptCipher.final('utf8');

        console.log(signal);

        signal = JSON.parse(signal);
        // console.log(signal);

        return signal;
    }

    decryptDecompress(encryptedCompressedSignal) {

        console.log(encryptedCompressedSignal);
        console.log(`trying to decrypt using ${this.key} len ${this.key.length}`);
        console.log(`iv: 0x${this.iv.toString('hex')}`);
        const decryptCipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv)

        // if no output-endcoding is given, returns a buffer..
        const compressedSignal = decryptCipher.update(encryptedCompressedSignal, 'base64');
        let fooSignal = decryptCipher.final();

        const signal = zlib.brotliDecompressSync(compressedSignal).toString('utf8');

        return signal;
    }
}
