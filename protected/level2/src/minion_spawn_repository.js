const MinionSpawn = require('./minion_spawn')
const spawnTimer = require('./spawn_timer')
const { locationsByTileId } = require('./map')

const MINION_SPAWN_ID = 20

const _minionSpawns = []
const MINION_RESPAWN_DURATION = process.env.NODE_ENV === 'sla' ? 0.1 : 5
const MINION_HEALTH = 30

// map.data.reverse().forEach((row, rowIndex) => {
//     row.forEach((tile, colIndex) => {
//         if (tile !== MINION_SPAWN_ID) { return }
//         const location = { x: colIndex, y: rowIndex }
//         const spawn = new MinionSpawn(location)
//         spawnTimer.add(spawn, MINION_RESPAWN_DURATION)
//         _minionSpawns.push(spawn)
//     })
// })

locationsByTileId(MINION_SPAWN_ID).forEach(location => {
    const spawn = new MinionSpawn(location)
    spawnTimer.add(spawn, MINION_RESPAWN_DURATION)
    _minionSpawns.push(spawn)
})

const minionSpawns = () => {
    return _minionSpawns
}

const findByLocation = (location) => {
    return _minionSpawns.find(spawn => JSON.stringify(spawn.location) === JSON.stringify(location))
}

const _resetMinionHealth = () => {
    _minionSpawns.forEach(spawn => {
        const minion = spawn.minion
        if (!minion) { return }
        minion.health = MINION_HEALTH
    })
}

const minionSpawnRepository = { minionSpawns, findByLocation, _resetMinionHealth }

module.exports.minionSpawns = minionSpawns
module.exports._resetMinionHealth = _resetMinionHealth
