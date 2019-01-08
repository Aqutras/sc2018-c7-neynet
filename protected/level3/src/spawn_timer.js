const _ = require('lodash')
const spawnables = []

const add = (target, duration) => {
    const entry = { target, duration }
    spawnables.push(entry)
}

const filteroutSpawning = () => {
    return _.remove(spawnables, spawnable => spawnable.duration <= 0)
}

const forward = () => {
    spawnables.forEach(spawnable => spawnable.duration -= 1)
}

const spawnTimer = { add, forward, filteroutSpawning }

module.exports = spawnTimer