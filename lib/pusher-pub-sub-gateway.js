const Pusher = require('pusher-js/dist/web/pusher')
const {Disposable} = require('event-kit')
const Errors = require('./errors')
const { io } = require("socket.io-client");

// yeah, this does not work anymore, no idea yet how to change it...

module.exports =
class PusherPubSubGateway {
  constructor ({key, options}) {
    this.channelsByName = new Map()
    this.subscriptionsCount = 0
    this.pusherClient = createDisconnectedPusherClient(key, options)
    // TODO: disconnect first and only reconnect later when required...
    this.socket = io("http://127.0.0.1:3456/")
  }

  async subscribe (channelName, eventName, callback) {
    console.log(`subscribe to channel ${channelName}`);
    // we use rooms in socket.io....


    channelName = channelName.replace(/\//g, '.')
    let channel = this.channelsByName.get(channelName)

    this.socket.emit("halo_subscribe", channelName)


    this.socket.on("peer_info", (eventName, data) => {
        console.log("peer_info:");
        console.log(data);
        // TODO: something like this???
        callback(data);
    })

    // channel.bind(eventName, callback)
    this.subscriptionsCount++

    return new Disposable(() => {
      // channel.unbind(eventName, callback)

      this.subscriptionsCount--
      if (this.subscriptionsCount === 0) this.disconnect()
    })

    // end-
    /*
    if (this.subscriptionsCount === 0) await this.connect()

    channelName = channelName.replace(/\//g, '.')
    let channel = this.channelsByName.get(channelName)
    if (!channel) {
      channel = this.pusherClient.subscribe(channelName)
      await new Promise((resolve, reject) => {
        channel.bind('pusher:subscription_succeeded', resolve)
        channel.bind('pusher:subscription_error', reject)
      })
      this.channelsByName.set(channelName, channel)
    }

    channel.bind(eventName, callback)
    this.subscriptionsCount++

    return new Disposable(() => {
      channel.unbind(eventName, callback)

      this.subscriptionsCount--
      if (this.subscriptionsCount === 0) this.disconnect()
    })
    */
  }

  connect () {
    const error = new Errors.PubSubConnectionError('Error establishing web socket connection to signaling server')
    this.pusherClient.connect()
    return new Promise((resolve, reject) => {
      const handleConnection = () => {
        this.pusherClient.connection.unbind('connected', handleConnection)
        this.pusherClient.connection.unbind('error', handleError)
        resolve()
      }

      const handleError = () => {
        this.pusherClient.connection.unbind('connected', handleConnection)
        this.pusherClient.connection.unbind('error', handleError)
        reject(error)
      }

      this.pusherClient.connection.bind('connected', handleConnection)
      this.pusherClient.connection.bind('error', handleError)
    })
  }

  disconnect () {
    this.channelsByName.forEach((channel) => {
      this.pusherClient.unsubscribe(channel)
    })
    this.channelsByName.clear()
    this.pusherClient.disconnect()
  }
}

function createDisconnectedPusherClient (key, options) {
  const connectOptions = Object.assign({
    encrypted: true,
  }, options)

  const client = new Pusher(key, connectOptions) // automatically connects to pusher
  client.disconnect()
  return client
}
