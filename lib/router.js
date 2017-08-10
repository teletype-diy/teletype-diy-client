const {CompositeDisposable, Emitter} = require('event-kit')
const {RouterMessage, RouterTrackMetadata} = require('./real-time_pb')

module.exports =
class Router {
  constructor (network) {
    this.network = network
    this.emitter = new Emitter()
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(network.onReceive(this.receive.bind(this)))
    this.subscriptions.add(network.onTrack(this.handleTrack.bind(this)))
    this.nextRequestId = 0
    this.requestPromiseResolveCallbacks = new Map()
    this.peerIdsByRequestId = new Map()
  }

  dispose () {
    this.subscriptions.dispose()
  }

  notify (channelId, message) {
    if (!(message instanceof Buffer)) {
      message = Buffer.from(message)
    }

    const notification = new RouterMessage.Notification()
    notification.setChannelId(channelId)
    notification.setBody(message)
    const routerMessage = new RouterMessage()
    routerMessage.setNotification(notification)
    this.network.broadcast(routerMessage.serializeBinary())
  }

  request (recipientId, channelId, message) {
    if (message && !(message instanceof Buffer)) {
      message = Buffer.from(message)
    }

    const requestId = this.nextRequestId++
    const request = new RouterMessage.Request()

    request.setChannelId(channelId)
    request.setRequestId(requestId)
    if (message) request.setBody(message)
    const routerMessage = new RouterMessage()
    routerMessage.setRequest(request)

    this.network.unicast(recipientId, routerMessage.serializeBinary())

    return new Promise((resolve) => {
      this.requestPromiseResolveCallbacks.set(requestId, resolve)
    })
  }

  respond (requestId, message) {
    const recipientId = this.peerIdsByRequestId.get(requestId)
    if (!recipientId) throw new Error('Multiple responses to the same request are not allowed')

    if (message && !(message instanceof Buffer)) {
      message = Buffer.from(message)
    }

    const response = new RouterMessage.Response()
    response.setRequestId(requestId)
    response.setBody(message)
    const routerMessage = new RouterMessage()
    routerMessage.setResponse(response)

    this.peerIdsByRequestId.delete(requestId)

    this.network.unicast(recipientId, routerMessage.serializeBinary())
  }

  broadcastTrack (channelId, metadata, track, stream) {
    const routerTrackMetadata = new RouterTrackMetadata()
    routerTrackMetadata.setChannelId(channelId)
    routerTrackMetadata.setApplicationMetadata(Buffer.from(metadata))
    this.network.broadcastTrack(routerTrackMetadata.serializeBinary(), track, stream)
  }

  onNotification (channelId, callback) {
    return this.emitter.on('notification:' + channelId, callback)
  }

  onRequest (channelId, callback) {
    return this.emitter.on('request:' + channelId, callback)
  }

  onTrack (channelId, callback) {
    return this.emitter.on('track:' + channelId, callback)
  }

  receive ({senderId, message}) {
    const routerMessage = RouterMessage.deserializeBinary(message)

    if (routerMessage.hasNotification()) {
      this.receiveNotification(senderId, routerMessage.getNotification())
    } else if (routerMessage.hasRequest()) {
      this.receiveRequest(senderId, routerMessage.getRequest())
    } else if (routerMessage.hasResponse()) {
      this.receiveResponse(routerMessage.getResponse())
    } else {
      throw new Error('Unsupported router message variant')
    }
  }

  receiveNotification (senderId, notification) {
    const channelId = notification.getChannelId()
    const body = Buffer.from(notification.getBody())
    this.emitter.emit(
      'notification:' + channelId,
      {senderId, message: body}
    )
  }

  receiveRequest (senderId, request) {
    const channelId = request.getChannelId()
    const requestId = request.getRequestId()
    const body = Buffer.from(request.getBody())
    this.peerIdsByRequestId.set(requestId, senderId)
    this.emitter.emit(
      'request:' + channelId,
      {senderId, requestId, request: body}
    )
  }

  receiveResponse (response) {
    const requestId = response.getRequestId()
    const requestResolveCallback = this.requestPromiseResolveCallbacks.get(requestId)
    requestResolveCallback(Buffer.from(response.getBody()))
  }

  handleTrack ({senderId, metadata, track}) {
    const routerTrackMetadata = RouterTrackMetadata.deserializeBinary(metadata)
    const channelId = routerTrackMetadata.getChannelId()
    const applicationMetadata = Buffer.from(routerTrackMetadata.getApplicationMetadata())

    this.emitter.emit(
      'track:' + channelId,
      {senderId, metadata: applicationMetadata, track}
    )
  }
}