const crypto = require('crypto')
const client = require('request')

const Users = require('./users')
const { map, locationsByTileId } = require('./map')
const config = require('./config')

const TOWER_ID = 10

const scoreStore = {}

const saveScore = (characterId, damage) => {
    const index = Users.IDS.indexOf(characterId)
    const name = Users.NAMES[index]

    const hash = crypto.createHash('sha256')
    hash.update(`Nx9FEXWt_${name}`)
    const digest = hash.digest('hex')
    console.log('digest', digest)

    const bodyParam = JSON.stringify({user_identifier: digest, damage: damage, type: 'attack'})
    console.log('body', bodyParam)
    try {
        client.post({
            url: `${config.scoreServer}/api/score`,
            headers: { 'content-type': 'application/json' },
            body: bodyParam
        }, (error, response, body) => {
            if (error) {
                console.log('post error', error)
                return
            }
            try {
              const parsedBody = JSON.parse(body)
              if (parsedBody.result !== 'success') {
                  console.log('got response but something went wrong')
              } else {
                const entry = scoreStore[characterId]
                entry.score = 0
              }
            } catch(e) {
              console.log('error while parsing JSON:', e)
              return
            }
        })
    } catch(e) {
        console.log('error', e)
    }
}

const addScore = (characterId, score) => {
    if (process.env.NODE_ENV === 'sla') { return }
    if (score === 0) { return }
    if (!scoreStore.hasOwnProperty(characterId)) {
        saveScore(characterId, score)
        scoreStore[characterId] = { lastSentAt: new Date(), score: 0 }
        return
    }
    const entry = scoreStore[characterId]
    if ((new Date() - entry.lastSentAt) < 1000) {
        entry.score += score
        return
    }
    saveScore(characterId, entry.score + score)
    entry.lastSentAt = new Date()
}

const location = locationsByTileId(TOWER_ID)[0]
module.exports = {addScore, location }
