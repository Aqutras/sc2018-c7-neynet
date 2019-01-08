const fs = require('fs')
const Character = require('./character')

const storagePath = './storage.json'

try {
    fs.statSync(storagePath)
} catch(err) {
    console.log('could not load from storage.json, creating new one.')
    fs.writeFileSync(storagePath, '{ "characters": [] }');
}

const load = () => {
    const storage = fs.readFileSync(storagePath, 'utf8')
    return JSON.parse(storage).characters.map(c => Character.restore(c))
}

const save = (characters) => {
    if (process.env.NODE_ENV === 'sla') return
    const content = { characters: characters }
    fs.writeFileSync(storagePath, JSON.stringify(content));
}

const CharacterStorage = { load, save }
module.exports = CharacterStorage
