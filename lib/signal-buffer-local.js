
// this class stores the signal if you want to do direct p2p connect
// how does it work? we just
// intercept the signal and
// store it until someone needs it.
//
// included in the
// signal are local network details
//
// for example your
// own local home
// router or gateway might be included
//
// yay, finally works
// outside of this class you just need to call replaySignalAsString to connect
// unless a direct connection is unavalible

const zlib = require('zlib');

module.exports =
class SignalBufferLocal {
    constructor() {
        this.sendBufferToUI = (_) => {};
        this.buffer = [];
        this.signalCrypt = null;
    }

    setSignalCrypt(signalCrypt) {
        this.signalCrypt = signalCrypt;
    }

    setupBufferCallback(callback) {
        this.sendBufferToUI = callback;
    }

    // during the initial connection
    // additional information is attached to the signal
    // dump the signal
    dumpSignal() {
        const output = this.replaySignalAsString();
        console.log(output);
    }

    // intercept the signal
    interceptSignal(signal) {
        console.log("was asked to intercept signal");
        this.buffer.push(signal);
        this.dumpSignal()
        // this.sendBufferToUI(this.replaySignalAsString());
        this.sendBufferToUI(this.replaySignalAsEncryptedString());
    }

    // most of the time, we need the signal as string
    // incidently,
    // sometimes we need the signal as buffer
    // signal could be encrypted or not, we do not care
    replaySignalAsString() {
        let output = "";
        this.buffer.forEach((item, i) => {
            output += `|${item}`;
        });
        return output;
    }

    replaySignalAsEncryptedString() {
        const signal = this.replaySignalAsString();
        const compressedSignal = zlib.brotliCompressSync(signal);
        console.log("what is compressedSignal:");
        console.log(compressedSignal);

        // TESTING_ locally breaks over network...

        // const simpleDecompressed = zlib.brotliDecompressSync(compressedSignal);
        // console.log(simpleDecompressed);

        const encryptedCompressedSignal = this.signalCrypt.encryptRaw(compressedSignal)
        const revCompressedSignal = this.signalCrypt.decryptRaw(encryptedCompressedSignal);

        console.log(revCompressedSignal);
        const revSignal = zlib.brotliDecompressSync(revCompressedSignal);
        console.log(revSignal);


        return this.signalCrypt.encryptRaw(compressedSignal)
    }

    replaySignal() {
        return this.buffer;
    }

    // your buffer should be reset
    // otherwise a new connection might break, at least the peer name
    // under the assumption, that it will try all candidates, it might still work
    resetBuffer() {
        this.buffer = [];
    }
}
