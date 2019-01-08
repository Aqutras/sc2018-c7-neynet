const WebSocket = require('ws')
const uuid = require('node-uuid')
const _ = require('lodash')
const fs = require('fs')

const Character = require('./src/character')
const MinionSpawnRepository = require('./src/minion_spawn_repository')
const CharacterRepository = require('./src/character_repository')
const config = require('./src/config')
const { locationsByTileId } = require('./src/map')
const spawnTimer = require('./src/spawn_timer')
const characterStorage = require('./src/character_storage')
let connections = require('./src/connections')
const Users = require('./src/users')
const Tower = require('./src/tower')
const expCalc = require('./src/exp_calculator')
const { attackCharacterAction, characterMoveAction, attackTowerAction, attackMinionAction } = require('./src/system/actions')
const { sendJson, broadcastJson, sendErrorJson } = require('./src/ws_helper')

const HEAL_TILE_ID = 40

let characters_map = {} // key: websocket.id(uuid), value: Character
const noop = () => {
}

function heartbeat() {
  this.isAlive = true
}

const isDoubleConnection = (characterId) => {
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

const removeConnection = (websocket) => {
  connections = connections.filter((conn) => conn !== websocket)
  delete characters_map[websocket.id]
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

const respawnCheck = (clients) => {
  spawnTimer.forward()
  const spawnings = spawnTimer.filteroutSpawning()
  spawnings.forEach(spawning => {
    const target = spawning.target
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
  // setTimeout(respawnCheck, 1000)
}

const buildWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    ws.id = uuid.v4()
    console.log('ws/connection')

    let accountsFile = fs.readFileSync('./accounts.json', 'utf8')
    let owner = JSON.parse(accountsFile).owner
    sendJson(ws, 'map_name', { mapName: config.mapName, owner })
    ws.on('pong', heartbeat)
    ws.on('message', (raw_message) => {
      console.log('received:', raw_message)
      let message
      try {
        message = JSON.parse(raw_message)
      } catch (e) {
        console.error(e)
        return
      }
      switch (message.ch) {
        case 'join_game':
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          if (!message.data || !message.data.id) {
            break
          }
          ws.joined = true
          addNewConnection(ws, message.data.id)
          broadcastJson(wss.clients, 'set_characters', { characters: Object.values(characters_map) })
          break
        case 'request_minions':
          const minions = MinionSpawnRepository.minionSpawns()
            .filter(spawn => spawn)
            .map(spawn => spawn.minion)
            .filter(minion => minion)
          sendJson(ws, 'set_minions', { minions })
          break
        case 'attack_character': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const targetWebsocketId = Object.keys(characters_map).filter(
            k => characters_map[k].id === message.data.character
          )[0]
          const targetWebsocket = connections.filter(con => con.id === targetWebsocketId)[0]
          const targetCharacter = characters_map[targetWebsocketId]
          const sourceCharacter = characters_map[ws.id]

          if (!targetWebsocketId || !targetWebsocket || !targetCharacter || !sourceCharacter) {
            break
          }

          const isSane = attackCharacterAction(ws, _.clone(sourceCharacter), _.clone(targetCharacter))
          if (!isSane) break

          const time = isSane[1]
          character.updateLastAnimation(time)

          targetCharacter.damage(sourceCharacter.attack)

          const targetIndex = Users.IDS.indexOf(targetCharacter.id)
          const targetName = Users.NAMES[targetIndex]
          const index = Users.IDS.indexOf(sourceCharacter.id)
          const name = Users.NAMES[index]

          sendJson(ws, 'update_log', `${targetName}に${sourceCharacter.attack}ダメージを与えました。`)
          sendJson(targetWebsocket, 'update_log', `${name}から${sourceCharacter.attack}ダメージを受けました。`)

          if (targetCharacter.health <= 0) {
            targetCharacter.die()
            handleEarnExp(ws, sourceCharacter, targetCharacter)
            broadcastJson(wss.clients, 'character_dead', { character: targetCharacter })
            sendJson(targetWebsocket, 'update_log', `${name}に倒されました。`)
            sendJson(ws, 'update_log', `${targetName}を倒しました。`)
          }
          sendJson(targetWebsocket, 'status_update', targetCharacter)
          break
        }
        case 'character_move': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)

          const location = message.data
          const character = characters_map[ws.id]
          if (!character || !location || !location.hasOwnProperty('x') || !location.hasOwnProperty('y')) {
            break
          }

          const isSane = characterMoveAction(ws, _.clone(character), _.clone(location), Object.values(characters_map))
          if (!isSane) break

          const time = isSane[1]
          character.updateLastAnimation(time)

          character.location = location
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
          if (!character) break
          const isSane = attackTowerAction(ws, _.clone(character))
          if (!isSane) break

          const time = isSane[1]
          character.updateLastAnimation(time)
          Tower.addScore(character.id, character.attack)
          sendJson(ws, 'update_log', `タワーに${character.attack}ダメージを与えました。`)
          break
        }
        case 'attack_minion': {
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const character = characters_map[ws.id]
          if (!message.data || !message.data.location || !message.data.location.hasOwnProperty('x') || !message.data.location.hasOwnProperty('y')) {
            console.log('invalid params')
            break
          }
          const { location } = message.data
          const spawn = MinionSpawnRepository.minionSpawns().find(
            s => JSON.stringify(s.location) === JSON.stringify(location)
          )
          if (!spawn) break
          const { minion } = spawn
          if (minion == null) {
            console.log('attacked minion not found')
            break
          }

          const isSane = attackMinionAction(wss.clients, ws, _.clone(character), _.clone(spawn))
          if (!isSane) break

          const time = isSane[1]
          character.updateLastAnimation(time)

          minion.damage(character.attack)
          character.damage(minion.attack)
          sendJson(ws, 'status_update', character)
          sendJson(ws, 'update_log', `ミニオンに${character.attack}ダメージを与えました。`)
          sendJson(ws, 'update_log', `ミニオンから${minion.attack}ダメージ受けました。`)
          if (character.health <= 0) {
            character.die()
            broadcastJson(wss.clients, 'character_dead', { character })
            sendJson(ws, 'update_log', `ミニオンに倒されました。`)
          }

          if (minion.isDead()) {
            minion.kill()
            handleEarnExp(ws, character, minion)
            broadcastJson(wss.clients, 'minion_dead', { id: minion.id })
            sendJson(ws, 'update_log', `ミニオンを倒しました。`)
          } else {
            console.log('minion on', spawn.location, 'now has health', minion.health)
          }
          break
        }
        case 'set_dead_character': {
          if (process.env.NODE_ENV !== 'sla') return
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          const character = characters_map[ws.id]
          if (!character) break
          character.die()
          broadcastJson(wss.clients, 'character_dead', { character })
          break
        }
        case 'reset_characters': {
          if (process.env.NODE_ENV !== 'sla') {
            break
          }
          console.log('receiving from', ws.id, 'on', message.ch, message.data)
          CharacterRepository._resetCharacters()
          _.forEach(characters_map, (character, wsId) => {
            characters_map[wsId] = CharacterRepository.all().find(c => character.id === c.id)
          })
          MinionSpawnRepository._resetMinionHealth()
          broadcastJson(wss.clients, 'set_characters', { characters: Object.values(characters_map) })
          break
        }
        default:
          console.log('undefined ch')
      }
    })

    ws.on('close', () => {
      removeConnection(ws)
    })
    setInterval(() => {
      respawnCheck(wss.clients)
    }, 1000)

  })
  setInterval(() => {
    characterStorage.save(CharacterRepository.all())
  }, 10 * 1000)

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate()

      ws.isAlive = false
      ws.ping(noop)
    })
  }, 5 * 1000)
}
module.exports = buildWebSocketServer
