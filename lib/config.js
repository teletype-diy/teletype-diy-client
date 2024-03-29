"use strict";

module.exports =
class Config {
    static noSignalServer() {
        return atom.config.get('teletype-diy.doPeer2PeerNoSignalServer');
    }

    static getIceServers() {
        return atom.config.get('teletype-diy.configSettings.iceServerURL')
    }
}
