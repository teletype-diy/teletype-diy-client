const assert = require('assert')
const {CompositeDisposable, Disposable, Emitter} = require('event-kit')
const PeerConnection = require('./peer-connection')
const PubSubSignalingProvider = require('./pub-sub-signaling-provider')
const Errors = require('./errors')
const Config = require('./config')

module.exports =
class PeerPool {
  constructor ({peerId, peerIdentity, pubSubGateway, signalURL, fragmentSize, connectionTimeout, testEpoch, signalBufferLocal}) {
    console.log("new peer pool with peerid "+peerId);
    this.peerId = peerId
    this.pubSubGateway = pubSubGateway
    this.signalURL = signalURL
    this.fragmentSize = fragmentSize
    this.connectionTimeout = connectionTimeout || 5000
    this.testEpoch = testEpoch
    this.emitter = new Emitter()
    this.subscriptions = new CompositeDisposable()
    this.peerConnectionsById = new Map()
    this.peerIdentitiesById = new Map([
      [peerId, peerIdentity]
    ])
    this.username = peerIdentity
    this.disposed = false
    this.listenersCount = 0
    this.signalCrypt = null
    this.signalBufferLocal = signalBufferLocal

    // set iceServers from config, must be a list for some reason
    const tmpIceServer = Config.getIceServers()
    if (tmpIceServer) {
        this.iceServers = [tmpIceServer]
    } else {
        this.iceServers = []
    }
  }

  setSignalCrypt(signalCrypt) {
    this.signalCrypt = signalCrypt
    this.signalCrypt.setIV(this.peerId);
  }

  async listen () {
    if (!this.listenPromise) {
      const timeoutError = new Errors.PubSubConnectionError('Timed out while subscribing to incoming signals')
      this.listenPromise = new Promise(async (resolve, reject) => {
        let rejected = false
        const timeoutId = window.setTimeout(() => {
          this.listenPromise = null
          reject(timeoutError)
          rejected = true
        }, this.connectionTimeout)

        const subscription = await this.pubSubGateway.subscribe(
          `/peers/${this.peerId}`,
          'signal',
          this.didReceiveSignal.bind(this)
        )
        if (rejected) {
          subscription.dispose()
        } else {
          window.clearTimeout(timeoutId)
          this.subscriptions.add(subscription)
          resolve(subscription)
        }
      })
    }

    this.listenersCount++
    const subscription = await this.listenPromise
    return new Disposable(() => {
      this.listenersCount--
      if (this.listenersCount === 0) {
        this.listenPromise = null
        subscription.dispose()
      }
    })
  }

  dispose () {
    this.disposed = true
    this.subscriptions.dispose()
    this.peerIdentitiesById.clear()
    this.disconnect()
  }

  getLocalPeerIdentity () {
    return this.peerIdentitiesById.get(this.peerId)
  }

  async connectTo (peerId) {
    console.log(`we want to connect to ${peerId}, anyone know them?`);
    if (this.peerId === peerId) {
      throw new Errors.PeerConnectionError('Sorry. You can\'t connect to yourself this way. Maybe try meditation or a walk in the woods instead?')
    }

    const peerConnection = this.getPeerConnection(peerId)

    try {
      await peerConnection.connect()
    } catch (error) {
      this.peerConnectionsById.delete(peerId)
      throw error
    }
  }

  getConnectedPromise (peerId) {
    return this.getPeerConnection(peerId).getConnectedPromise()
  }

  getDisconnectedPromise (peerId) {
    if (this.peerConnectionsById.has(peerId)) {
      return this.peerConnectionsById.get(peerId).getDisconnectedPromise()
    } else {
      return Promise.resolve()
    }
  }

  disconnect () {
    this.peerConnectionsById.forEach((peerConnection) => {
      peerConnection.disconnect()
    })
    this.peerConnectionsById.clear()
  }

  send (peerId, message) {
    const peerConnection = this.peerConnectionsById.get(peerId)
    if (peerConnection) {
      peerConnection.send(message)
    } else {
      throw new Error('No connection to peer')
    }
  }

  onDisconnection (callback) {
    return this.emitter.on('disconnection', callback)
  }

  onReceive (callback) {
    return this.emitter.on('receive', callback)
  }

  onError (callback) {
    return this.emitter.on('error', callback)
  }

  isConnectedToPeer (peerId) {
    const peerConnection = this.peerConnectionsById.get(peerId)
    return peerConnection ? (peerConnection.state === 'connected') : false
  }

  getPeerIdentity (peerId) {
    return this.peerIdentitiesById.get(peerId)
  }

  didReceiveSignal (encryptedMessage) {
    const message = this.signalCrypt.decrypt(encryptedMessage)
    console.log("## didReceiveSignal got called, used this as message:");
    console.log(message);
    const {senderId, senderIdentity} = message
    console.log("## senderId:");
    console.log(senderId);
    if (senderIdentity) this.peerIdentitiesById.set(senderId, senderIdentity)
    const peerConnection = this.getPeerConnection(senderId)
    peerConnection.signalingProvider.receiveMessage(message)
  }

  // TODO: move(?) remove this... refactor or whatever
  injectExternalSignal(encryptedCompressedSignal) {
    // decrypt
    const messageList = this.signalCrypt.decryptDecompress(encryptedCompressedSignal);
    console.log(messageList);
    messageList.split("|").forEach((item, i) => {
        if (item) {
            console.log(`got signal-item: ${item}`);
            const message = JSON.parse(item);
            // const message = JSON.parse(item);
            console.log("## injectExternalSignal got called, used this as message:");
            console.log(message);
            const {senderId, senderIdentity} = message
            console.log("## senderId:");
            console.log(senderId);
            if (senderIdentity) this.peerIdentitiesById.set(senderId, senderIdentity)
            const peerConnection = this.getPeerConnection(senderId)
            peerConnection.signalingProvider.receiveMessage(message)
        }
    });
  }

  didDisconnect (peerId) {
    this.peerConnectionsById.delete(peerId)
    this.emitter.emit('disconnection', {peerId})
  }

  didReceiveMessage (event) {
    this.emitter.emit('receive', event)
  }

  peerConnectionDidError ({peerId, event}) {
    this.didDisconnect(peerId)
    this.emitter.emit('error', event)
  }

  getPeerConnection (peerId) {
    let peerConnection = this.peerConnectionsById.get(peerId)
    if (!peerConnection) {
      peerConnection = new PeerConnection({
        localPeerId: this.peerId,
        remotePeerId: peerId,
        fragmentSize: this.fragmentSize,
        iceServers: this.iceServers,
        connectionTimeout: this.connectionTimeout,
        didReceiveMessage: this.didReceiveMessage.bind(this),
        didDisconnect: this.didDisconnect.bind(this),
        didError: this.peerConnectionDidError.bind(this),
        signalingProvider: new PubSubSignalingProvider({
          localPeerId: this.peerId,
          remotePeerId: peerId,
          // if we also pass signalURL, we can do the signaling ourselves...
          signalURL: this.signalURL,
          signalCrypt: this.signalCrypt,
          username: this.username,
          testEpoch: this.testEpoch,
          signalBufferLocal: this.signalBufferLocal
        })
      })
      this.peerConnectionsById.set(peerId, peerConnection)
    }
    return peerConnection
  }
}
