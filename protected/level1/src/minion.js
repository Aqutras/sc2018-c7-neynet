const MinionSpawnRepository =  require('./minion_spawn_repository')

class Minion {
    constructor(id, location) {
        this.id = id
        this.health = 30
        this.attack = 1
        this.location = location
    }
    damage(damage) {
        this.health -= damage
    }
    isDead() {
        return this.health <= 0
    }
    kill() {
        const spawns = MinionSpawnRepository.minionSpawns()
        const spawn = spawns.find(spawn => JSON.stringify(spawn.location) === JSON.stringify(this.location))
        spawn.minion = null
        spawn.resetTimer()
    }
}

module.exports = Minion
