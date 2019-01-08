/* eslint-disable no-prototype-builtins,no-underscore-dangle */
const WebSocket = require('ws')
const uuid = require('node-uuid')
const _ = require('lodash')
const fs = require('fs')

// const Character = require('./src/character')
const Tower = require('./src/tower')
const MinionSpawnRepository = require('./src/minion_spawn_repository')
const CharacterRepository = require('./src/character_repository')
const Users = require('./src/users')
const config = require('./src/config')
const { locationsByTileId, isOutOfMap } = require('./src/map')
const expCalc = require('./src/exp_calculator')
const spawnTimer = require('./src/spawn_timer')
const characterStorage = require('./src/character_storage')

// const NUM_PLAYERS = 4
const WALL_TILE_ID = 5
const HEAL_TILE_ID = 40

let connections = []
let characters_map = {} // key: websocket.id(uuid), value: Character

const noop = () => {}

function heartbeat() {
  this.isAlive = true
}

const isDoubleConnection = characterId => {
  const foundWebsocketId = Object.keys(characters_map).find(key => characters_map[key].id === characterId)
  return foundWebsocketId
}

const addNewConnection = (websocket, characterId) => {
  connections.push(websocket)
  const lastWebsocketId = isDoubleConnection(characterId)
  if (!lastWebsocketId) {
    const character = CharacterRepository.all().find(c => c.id === characterId)
    if (character == null) {
      return
    }
    characters_map[websocket.id] = character
    return
  }
  const character = characters_map[lastWebsocketId]
  delete characters_map[lastWebsocketId]
  const connection = connections.filter(con => con.id === lastWebsocketId)[0]
  if (connection) {
    connection.close()
    const index = connections.indexOf(connection)
    connections.splice(index, 1)
  }
  characters_map[websocket.id] = character
}

const removeConnection = websocket => {
  connections = connections.filter(conn => conn !== websocket)
  delete characters_map[websocket.id]
}

const sendJson = (ws, ch, data) => {
  const response = JSON.stringify({ ch, data })
  console.log('sending... to', ws.id, 'on', ch, data)
  ws.send(response)
}

const broadcastJson = (clients, ch, data) => {
  const response = JSON.stringify({ ch, data })
  console.log('broadcasting...', 'on', ch, data)
  try {
    clients.forEach(conn => {
      if (conn.readyState === 1 && conn.joined) {
        conn.send(response)
      } else {
        console.log('socket is not open.')
      }
    })
  } catch (e) {
    console.log(e)
  }
}
const sendErrorJson = (ws, ch, data) => {
  const error = {
    request: data.ch,
    params: data.params,
    reason: data.reason,
  }

  const response = JSON.stringify({ ch, data: error })
  console.log('sending error to', ws.id, 'on', ch, data)
  ws.send(response)
}

const respawnCheck = clients => {
  spawnTimer.forward()
  const spawnings = spawnTimer.filteroutSpawning()
  spawnings.forEach(spawning => {
    const { target } = spawning
    target.spawn()
    switch (target.constructor.name) {
      case 'MinionSpawn': {
        broadcastJson(clients, 'minion_spawn', { minion: target.minion })
        break
      }
      case 'Character': {
        broadcastJson(clients, 'character_spawn', { character: target })
        break
      }
      default:
        console.warn('unreachable branch')
    }
  })
}

const handleEarnExp = (ws, attacker, target) => {
  const exp = expCalc(attacker, target)
  attacker.earnExp(exp)
  if (attacker.canLevelUp()) {
    attacker.levelUp()
    sendJson(ws, 'level_up', { character: attacker })
  } else {
    sendJson(ws, 'earn_exp', { exp: attacker.exp })
  }
}
const onAttackCharacter = (ws, message, charaMap, targetWsId) => {
  if (!message.data || !message.data.character) {
    return null
  }
  const targetCharacter = charaMap[targetWsId]
  const sourceCharacter = charaMap[ws.id]

  if (!targetWsId || !targetCharacter || !sourceCharacter) {
    return null
  }
  if (sourceCharacter.isDead()) {
    console.log('canceling process due to the character is already dead')
    return null
  }

  const time = new Date()
  if (!sourceCharacter.isAnimatable(time)) {
    const data = {
      ch: 'attack_character',
      params: message.data,
      reason: 'too many action in duration',
    }
    return { state: 'error', messages: [{ wsId: ws.id, ch: 'error_on_game', data }] }
  }
  if (!sourceCharacter.isNextTo(targetCharacter.location)) {
    const data = {
      ch: 'attack_character',
      params: message.data,
      reason: 'the character is not enough close to attack',
    }
    return { state: 'error', messages: [{ wsId: ws.id, ch: 'error_on_game', data }] }
  }

  if (targetCharacter.isDead()) {
    const data = {
      ch: 'attack_character',
      params: message.data,
      reason: 'the character is already dead',
    }
    return { state: 'error', messages: [{ wsId: ws.id, ch: 'error_on_game', data }] }
  }
  sourceCharacter.updateLastAnimation(time)
  targetCharacter.damage(sourceCharacter.attack)

  const targetIndex = Users.IDS.indexOf(targetCharacter.id)
  const targetName = Users.NAMES[targetIndex]
  const index = Users.IDS.indexOf(sourceCharacter.id)
  const name = Users.NAMES[index]

  return {
    state: 'success',
    messages: [
      { wsId: ws.id, ch: 'update_log', data: `${targetName}に${sourceCharacter.attack}ダメージを与えました。` },
      { wsId: targetWsId, ch: 'update_log', data: `${name}から${sourceCharacter.attack}ダメージを受けました。` },
    ],
  }
}
const onCharacterMove = (character, message, charaMap) => {
  if (character.isDead()) {
    return null
  }
  if (!message.data || !message.data.hasOwnProperty('x') || !message.data.hasOwnProperty('y')) {
    return null
  }
  const location = message.data
  const time = new Date()

  if (!character.isAnimatable(time)) {
    const data = {
      ch: 'character_move',
      params: message.data,
      reason: 'too many action in duration',
    }
    return [data]
  }
  if (isOutOfMap(location)) {
    const data = {
      ch: 'character_move',
      params: location,
      reason: 'the location is out of map',
    }
    return [data]
  }
  if (!character.isNextTo(location)) {
    const data = {
      ch: 'character_move',
      params: location,
      reason: 'the tile is not close to move to',
    }
    return [data]
  }
  const otherCharacters = Object.values(charaMap)
  const characterLocations = otherCharacters.map(c => JSON.stringify(c.location))
  if (characterLocations.indexOf(JSON.stringify(location)) >= 0) {
    const data = {
      ch: 'character_move',
      params: location,
      reason: 'the tile is occupied by other character',
    }
    return [data]
  }
  const wallLocations = locationsByTileId(WALL_TILE_ID)
  const isLocationOnWall = wallLocations.find(l => JSON.stringify(location) === JSON.stringify(l))
  if (isLocationOnWall) {
    const data = {
      ch: 'character_move',
      params: location,
      reason: 'cannot move to the tile',
    }
    return [data]
  }
  character.updateLastAnimation(time)
  character.location = location
}

const buildWebSocketServer = server => {
  const wss = new WebSocket.Server({ server, path: '/ws' })

  wss.on('connection', ws => {
    // eslint-disable-next-line no-param-reassign
    ws.id = uuid.v4()
    console.log('ws/connection')

    let accountsFile = fs.readFileSync('./accounts.json', 'utf8')
    let owner = JSON.parse(accountsFile).owner

    sendJson(ws, 'map_name', { mapName: config.mapName, owner })
    ws.on('pong', heartbeat)
    ws.on('message', rawMessage => {
      console.log('received:', rawMessage)
      let message
      try {
        message = JSON.parse(rawMessage)
      } catch (e) {
        console.error(e)
        return
      }
      switch (message.ch) {
        case 'join_game': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          if (!message.data || !message.data.id) return
          // eslint-disable-next-line no-param-reassign
          ws.joined = true
          addNewConnection(ws, message.data.id)
          broadcastJson(wss.clients, 'set_characters', { characters: Object.values(characters_map) })
          break
        }
        case 'request_minions': {
          const minions = MinionSpawnRepository.minionSpawns()
            .filter(spawn => spawn)
            .map(spawn => spawn.minion)
            .filter(minion => minion)
          sendJson(ws, 'set_minions', { minions })
          break
        }
        case 'attack_character': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          //
          const targetWebsocketId = Object.keys(characters_map).filter(
            k => characters_map[k].id === message.data.character
          )[0]
          const targetWebsocket = connections.filter(con => con.id === targetWebsocketId)[0]
          const targetCharacter = characters_map[targetWebsocketId]
          const sourceCharacter = characters_map[ws.id]
          //
          const response = onAttackCharacter(ws, message, characters_map, targetWebsocketId)
          if (response === null) break
          _.each(response.messages, msg => {
            if (msg.wsId === 'broadcast') {
              broadcastJson(wss, msg.ch, msg.data)
              return null
            }
            const to = connections.filter(con => con.id === msg.wsId)[0]
            if (!to) return null
            sendJson(to, msg.ch, msg.data)
          })
          if (response.state !== 'success') break
          //
          if (targetCharacter.health <= 0) {
            targetCharacter.die()
            handleEarnExp(ws, sourceCharacter, targetCharacter)
            broadcastJson(wss.clients, 'character_dead', { character: targetCharacter })
            const targetIndex = Users.IDS.indexOf(targetCharacter.id)
            const targetName = Users.NAMES[targetIndex]
            const index = Users.IDS.indexOf(sourceCharacter.id)
            const name = Users.NAMES[index]
            sendJson(targetWebsocket, 'update_log', `${name}に倒されました。`)
            sendJson(ws, 'update_log', `${targetName}を倒しました。`)
          }
          sendJson(targetWebsocket, 'status_update', targetCharacter)
          break
        }
        case 'character_move': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const character = characters_map[ws.id]
          const location = message.data
          if (!character || !location || !location.hasOwnProperty('x') || !location.hasOwnProperty('y')) {
            break
          }
          const responses = onCharacterMove(character, message, characters_map)
          if (responses === null) break
          if (!_.isEmpty(responses)) {
            _.each(responses, res => sendErrorJson(ws, 'error_on_game', res))
            break
          }
          broadcastJson(wss.clients, 'update_character_location', { id: character.id, location })
          const healLocations = locationsByTileId(HEAL_TILE_ID).map(loc => JSON.stringify(loc))
          if (healLocations.indexOf(JSON.stringify(location)) >= 0) {
            character.heal()
            sendJson(ws, 'status_update', character)
          }
          break
        }
        case 'attack_tower': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const character = characters_map[ws.id]
          if (character.isDead()) {
            return
          }
          const time = new Date()

          if (!character.isAnimatable(time)) {
            const data = {
              ch: 'attack_character',
              params: message.data,
              reason: 'too many action in duration',
            }
            sendErrorJson(ws, 'error_on_game', data)
            return
          }
          if (!character.isNextTo(Tower.location)) {
            const data = {
              ch: 'attack_character',
              params: message.data,
              reason: 'the character is not enough close to attack',
            }
            sendErrorJson(ws, 'error_on_game', data)
            return
          }

          character.updateLastAnimation(time)
          Tower.addScore(character.id, character.attack)
          sendJson(ws, 'update_log', `タワーに${character.attack}ダメージを与えました。`)
          console.log('SCORED!! ', character.id, 'earned', character.attack)
          break
        }
        case 'attack_minion': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          if (
            !message.data ||
            !message.data.location ||
            !message.data.location.hasOwnProperty('x') ||
            !message.data.location.hasOwnProperty('y')
          ) {
            return
          }
          const character = characters_map[ws.id]
          if (character.isDead()) {
            return
          }
          const { location } = message.data
          const spawn = MinionSpawnRepository.minionSpawns().find(
            spwn => JSON.stringify(spwn.location) === JSON.stringify(location)
          )
          if (!spawn) return
          const time = new Date()

          if (!character.isAnimatable(time)) {
            const data = {
              ch: 'attack_character',
              params: message.data,
              reason: 'too many action in duration',
            }
            sendErrorJson(ws, 'error_on_game', data)
            return
          }
          if (!character.isNextTo(spawn.location)) {
            const data = {
              ch: 'attack_minion',
              params: message.data,
              reason: 'the minion is not enough close to attack',
            }
            sendErrorJson(ws, 'error_on_game', data)
            return
          }
          const { minion } = spawn
          if (minion == null) {
            console.log('attacked minion not found')
            return
          }
          character.updateLastAnimation(time)
          minion.damage(character.attack)
          character.damage(minion.attack)
          sendJson(ws, 'status_update', character)
          sendJson(ws, 'update_log', `ミニオンに${character.attack}ダメージを与えました。`)
          sendJson(ws, 'update_log', `ミニオンから${minion.attack}ダメージ受けました。`)
          if (minion.isDead()) {
            minion.kill()
            handleEarnExp(ws, character, minion)
            broadcastJson(wss.clients, 'minion_dead', { id: minion.id })
            sendJson(ws, 'update_log', `ミニオンを倒しました。`)
          } else {
            console.log('minion on', spawn.location, 'now has health', minion.health)
          }
          if (character.health <= 0) {
            character.die()
            broadcastJson(wss.clients, 'character_dead', { character })
            sendJson(ws, 'update_log', `ミニオンに倒されました。`)
          }
          break
        }
        case 'reset_characters':
          if (process.env.NODE_ENV !== 'sla') {
            return
          }
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          CharacterRepository._resetCharacters()
          _.forEach(characters_map, (character, wsId) => {
            characters_map[wsId] = CharacterRepository.all().find(c => character.id === c.id)
            MinionSpawnRepository._resetMinionHealth()
          })
          broadcastJson(wss.clients, 'set_characters', { characters: Object.values(characters_map) })
          break
        case 'set_dead_character': {
          if (process.env.NODE_ENV !== 'sla') return
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const character = characters_map[ws.id]
          if (!character) break
          character.die()
          broadcastJson(wss.clients, 'character_dead', { character })
          break
        }
        default:
          console.log('undefined ch')
      }
    })
    ws.on('close', () => {
      removeConnection(ws)
      ws.close()
    })
  })

  setInterval(() => {
    respawnCheck(wss.clients)
  }, 1000)
  setInterval(() => {
    characterStorage.save(CharacterRepository.all())
  }, 10 * 1000)
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate()

      // eslint-disable-next-line no-param-reassign
      ws.isAlive = false
      ws.ping(noop)
      return null
    })
  }, 5 * 1000)
}

module.exports = buildWebSocketServer
