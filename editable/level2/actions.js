const { broadcastJson, sendJson, sendErrorJson, WALL_TILE_ID } = require('../ws_helper')
const { locationsByTileId ,isOutOfMap } = require('../map')
const Users = require('../users')
const Tower = require('../tower')
const MinionSpawnRepository = require('../minion_spawn_repository')
const _ = require('lodash')

const attackCharacterAction = (ws, source, target) => {
    const time = new Date()
    if (!source.isAnimatable(time)) {
        const data = {
            ch: 'attack_character',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    if (!source.isNextTo(target.location)) {
        const data = {
            ch: 'attack_character',
            reason: 'the character is not enough close to attack',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    console.log('target is dead?', target.isDead())
    console.log('target character: ', target)
    if (target.isDead()) {
        const data = {
            ch: 'attack_character',
            reason: 'the character is already dead',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false``
    }
    return [true, time]
}

const characterMoveAction = (ws, character, location, otherCharacters) => {
    const time = new Date()

    if (character.isDead()) { return false }

    if (isOutOfMap(location)) {
        const data = {
            ch: 'character_move',
            reason: 'the location is out of map',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    if (!character.isNextTo(location)) {
        const data = {
            ch: 'attack_character',
            reason: 'the tile is not close to move to',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }

    const characterLocations = otherCharacters.map(c => JSON.stringify(c.location))
    if (characterLocations.indexOf(JSON.stringify(location)) >= 0) {
        const data = {
            ch: 'character_move',
            reason: 'the tile is occupied by other character',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    return [true, time]
}

const attackTowerAction = (ws, character) => {
    const time = new Date()
    if (!character.isAnimatable(time)) {
        const data = {
            ch: 'attack_character',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }

    return [true, time]
}

const attackMinionAction = (clients, ws, character, spawn) => {
    const time = new Date()
    if (!character.isAnimatable(time)) {
        const data = {
            ch: 'attack_character',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    const minion = spawn.minion
    if (minion == null) {
        console.log('attacked minion not found')
        return false
    }
    return [true, time]
}
const actions = { attackCharacterAction, characterMoveAction, attackTowerAction, attackMinionAction }

module.exports = actions
