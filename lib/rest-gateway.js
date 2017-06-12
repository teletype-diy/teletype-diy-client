const {URL} = require('url')

module.exports =
class RestGateway {
  constructor ({baseURL}) {
    this.baseURL = baseURL
  }

  async get (relativeURL) {
    const url = new URL(relativeURL, this.baseURL).toString()
    const response = await window.fetch(url, {
      method: 'GET',
      headers: {'Accept': 'application/json'}
    })
    return response.json()
  }

  async put (relativeURL, body) {
    const url = new URL(relativeURL, this.baseURL).toString()
    const response = await window.fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    return response.json()
  }

  async post (relativeURL, body) {
    const url = new URL(relativeURL, this.baseURL).toString()
    const response = await window.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    return response.json()
  }
}