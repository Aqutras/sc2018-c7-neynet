const uuid = require('uuid')
const Minion = require('./minion')
const spawnTimer = require('./spawn_timer')
const MINION_RESPAWN_DURATION = 5

class MinionSpawn {
    constructor(location) {
        this.location = location
        this.minion = null
    }

    spawn() {
        this.minion = new Minion(uuid.v4(), this.location)
    }
    resetTimer() {
        spawnTimer.add(this, MINION_RESPAWN_DURATION)
    }
    hasMinion() {
        return !!this.minion
    }
}

module.exports = MinionSpawn
