const _ = require('lodash')
const fs = require('fs')
const config = require('./config')

const mapFile = fs.readFileSync('./public/maps.json', 'utf8')
const map = JSON.parse(mapFile).maps.find(map => map.name === config.mapName)

const locationsByTileId = (tileId) => {
    const locationsMapped = _.clone(map.data).reverse().map((row, rowIndex) =>
        row.map((tile, colIndex) => tile === tileId ? {x: colIndex, y: rowIndex} : null)
    )
    return _.flatten(locationsMapped).filter(location => location)
}

const isOutOfMap = (location) => {
    if (location.x < 0 || map.width - 1 < location.x) { return true }
    return location.y < 0 || map.height - 1 < location.y
}

module.exports.map = map
module.exports.locationsByTileId = locationsByTileId
module.exports.isOutOfMap = isOutOfMap