const WALL_TILE_ID = 5
let connections = require('./connections')
const expCalc = require('./exp_calculator')

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
    } catch(e) {
        console.log(e)
    }
}

const sendErrorJson = (ws, ch, data) => {
    const error = {
        request: data.ch,
        params: data.params,
        reason: data.reason
    }
    const response = JSON.stringify({ ch, data: error })
    console.log('sending error to', ws.id, 'on', ch, data)
    ws.send(response)
}

const helpers = { sendJson, broadcastJson, sendErrorJson, WALL_TILE_ID }

module.exports = helpers
