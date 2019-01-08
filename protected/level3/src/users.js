const fs = require('fs')

let accountsFile = fs.readFileSync('./accounts.json', 'utf8')
let accounts = JSON.parse(accountsFile).accounts
let userNames = accounts.map(account => account.id.split('#')[0])

console.log('names', userNames)

const USER_IDS = accounts.map(account => account.id)

const authenticate = (userName, password) => {
  accountsFile = fs.readFileSync('./accounts.json', 'utf8')
  accounts = JSON.parse(accountsFile).accounts
  userNames = accounts.map(account => account.id)
  const account = accounts.find(account => account.id === userName)
  if (!account) { return false }
  return account.password === password
}

const Users = { NAMES: userNames, IDS: USER_IDS, authenticate }
module.exports = Users
