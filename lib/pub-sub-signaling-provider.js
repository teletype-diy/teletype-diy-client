const Errors = require('./errors')
const { io } = require("socket.io-client");

module.exports =
class PubSubSignalingProvider {
  constructor ({localPeerId, remotePeerId, restGateway, signalURL, signalCrypt, username, testEpoch, signalBufferLocal}) {
    this.localPeerId = localPeerId
    this.remotePeerId = remotePeerId
    this.restGateway = restGateway
    this.socket = io(signalURL, {autoConnect: false})
    this.signalURL = signalURL
    this.signalCrypt = signalCrypt
    this.username = username
    this.testEpoch = testEpoch
    this.incomingSequenceNumber = 0
    this.outgoingSequenceNumber = 0
    this.incomingSignals = {}
    this.signalBufferLocal = signalBufferLocal
  }

  async send (signal) {
    const request = {
      senderId: this.localPeerId,
      sequenceNumber: this.outgoingSequenceNumber++,
      signal
    }
    if (this.testEpoch != null) request.testEpoch = this.testEpoch

    // what if we did the request ourselves instead of the api-gateway
    // const {ok, status, body} = await this.restGateway.post(`/peers/${this.remotePeerId}/signals`, request)
    // if (status === 401) {
    //   throw new Errors.InvalidAuthenticationTokenError('The provided authentication token is invalid')
    // } else if (!ok) {
    //   throw new Errors.PubSubConnectionError('Error signalling peer: ' + body.message)
    // }

    // --- from server

    if (request.sequenceNumber === 0) request.senderIdentity = this.username

    console.log(`/peers/${this.remotePeerId} signal :`);
    console.log(request);
    console.log(`using signalurl: ${this.signalURL}`);
    // pubSubGateway.broadcast(`/peers/${req.params.id}`, 'signal', message)
    //  broadcast (channelName, eventName, data) {
    let channelName = `/peers/${this.remotePeerId}`
    channelName = channelName.replace(/\//g, '.')

    // pretty sure eventname gets discarded on the other side anyway...
    const eventName = "signal"
    // --- from server end
    console.log(JSON.stringify(request));

    const data = this.signalCrypt.encrypt(request)
    this.signalBufferLocal.interceptSignal(JSON.stringify(data));
    if (atom.config.get('teletype-diy.doPeer2PeerNoSignalServer')) {
        return
    }

    // open and close socket to signalURL
    // await this.socket.connect()
    console.log(`$chn: ${channelName}`);
    const socket = io(this.signalURL)

    socket.on("connect_error", (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
    socket.emit("halo", channelName, eventName, data)
    // socket.disconnect()
    console.log("log after socket emit halo...");
  }

  async receiveMessage ({testEpoch, sequenceNumber, signal}) {
    if (this.testEpoch && this.testEpoch !== testEpoch) return

    this.incomingSignals[sequenceNumber] = signal

    if (!this.receivingSignals) {
      this.receivingSignals = true
      while (true) {
        const signal = this.incomingSignals[this.incomingSequenceNumber]
        if (signal) {
          delete this.incomingSignals[this.incomingSequenceNumber]
          await this.receive(signal)
          this.incomingSequenceNumber++
        } else {
          break
        }
      }
      this.receivingSignals = false
    }
  }
}
