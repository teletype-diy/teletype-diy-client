const {HTTPRequestError} = require('./errors')
const { io } = require("socket.io-client");

// TODO: this is no longer REST. rename this.
module.exports =
class RestGateway {
  constructor ({signalURL}) {
    this.signalURL = signalURL
    this.oauthToken = null
  }

  setOauthToken (oauthToken) {
    this.oauthToken = oauthToken
  }

  async protocol_version() {
    const socket = io(this.signalURL)

    // https://socket.io/docs/v3/emitting-events/#acknowledgements
    const withTimeout = (onSuccess, onTimeout, timeout) => {
      let called = false;

      const timer = setTimeout(() => {
        if (called) return;
        called = true;
        onTimeout();
      }, timeout);

      return (...args) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        onSuccess.apply(this, args);
      }
    }

    return new Promise((resolve, reject) => {
        socket.emit("protocol_version", withTimeout((response) => {
            if (response) {
                resolve(response);
            } else {
                reject("responses failed")
            }
        }, () => {
            reject("no connection to server");
        }, 10000));
    });
  }
}

const PORTAL_ID_REGEXP = /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g

function getDiagnosticMessage ({method, url, status, rawBody}) {
  let message = `Request: ${method} ${url}`
  if (status) message += `\nStatus Code: ${status}`
  if (rawBody) message += `\nBody: ${rawBody}`
  return message.replace(PORTAL_ID_REGEXP, 'REDACTED')
}
