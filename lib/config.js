
module.exports =
class Config {
    static noSignalServer() {
        return atom.config.get('teletype-diy.doPeer2PeerNoSignalServer');
    }
}
