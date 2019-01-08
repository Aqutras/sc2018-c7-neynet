const { sendJson, broadcastJson, sendErrorJson,  WALL_TILE_ID } = require('../ws_helper')
const Users = require('../users')
const { locationsByTileId, isOutOfMap } = require('../map')
const Tower = require('../tower')
const MinionSpawnRepository = require('../minion_spawn_repository')

const attackCharacterAction = (ws, source, target) => {
    if (source.isDead()) { return false }

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
        return false
    }
    return [true, time]
}

const characterMoveAction = (ws, character, location, characters) => {
    if (character.isDead()) { return false }

    const time = new Date()
    if (!character.isAnimatable(time)) {
        const data = {
            ch: 'character_move',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    if (isOutOfMap(location)) {
        const data = {
            ch: 'character_move',
            reason: 'the location is out of map',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    const wallLocations = locationsByTileId(WALL_TILE_ID)
    const isLocationOnWall = wallLocations.find(l => JSON.stringify(location) === JSON.stringify(l))
    if (isLocationOnWall) {
        const data = {
            ch: 'character_move',
            reason: 'cannot move to the tile',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    return [true, time]
}

const attackTowerAction = (ws, character) => {
    if (character.isDead()) { return false }
    const time = new Date()

    if (!character.isAnimatable(time)) {
        const data = {
            ch: 'attack_character',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    if (!character.isNextTo(Tower.location)) {
        const data = {
            ch: 'attack_character',
            reason: 'the character is not enough close to attack',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    return [true, time]
}

const attackMinionAction = (clients, ws, character, spawn) => {
    if (character.isDead()) { return false }
    if (!spawn) { return  false }
    const time = new Date()

    if (!character.isAnimatable(time)) {
        const data = {
            ch: 'attack_character',
            reason: 'too many action in duration',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    if (!character.isNextTo(spawn.location)) {
        const data = {
            ch: 'attack_minion',
            reason: 'the minion is not enough close to attack',
        }
        sendErrorJson(ws, 'error_on_game', data)
        return false
    }
    const minion = spawn.minion
    character.updateLastAnimation(time)
    return [true, time]
}
const actions = { attackCharacterAction, characterMoveAction, attackTowerAction, attackMinionAction }
module.exports = actions
