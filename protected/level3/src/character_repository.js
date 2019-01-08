const Users = require('./users')
const Character = require('./character')
const Map = require('./map')
const _ = require('lodash')
const characterStorage = require('./character_storage')

const RESPAWN_TILE_ID = 30

const respawnLocations = Map.locationsByTileId(RESPAWN_TILE_ID)

const generateCharacters = () => {
    return _.zip(Users.IDS, respawnLocations).map((pair, index) => {
        const id = pair[0]
        const location = pair[1]
        return new Character(id, location, index)
    })
}

const initCharacters = () => {
    const stored = characterStorage.load()
    if (stored.length > 0) {
        return stored
    }
    return generateCharacters()
}

let _characters = initCharacters()

const _resetCharacters = () => {
    _characters = generateCharacters()
}

const all = () => {
    return _characters
}

const CharacterRepository = { all, _resetCharacters }

module.exports = CharacterRepository
