const expCap = (level) => Math.round(5 + Math.log(level) ** 1.5 * 20)
const spawnTimer = require('./spawn_timer')
const CHARACTER_RESPAWN_DURATION = 5

const ANIMATE_DURATION = 1 // sec

const healAmount = () => {
  return 10
}

class Character {
  static restore(data) {
    const character = new Character(data.id, data.respawnLocation, data.index)
    character.location = data.location
    character.health = data.health
    character.attack = data.attack
    character.level = data.level
    character.exp = data.exp
    character.expCap = data.expCap
    character.state = data.state
    character.lastAnimation = new Date(data.lastAnimation)
    return character
  }

  constructor(id, respawnLocation, index) {
    this.id = id
    this.respawnLocation = respawnLocation
    this.location = respawnLocation
    this.health = process.env.NODE_ENV === 'sla' ? 30 : 100
    this.attack = 10
    this.level = 1
    this.exp = 0
    this.expCap = expCap(this.level)
    this.state = 'alive'
    this.lastAnimation = new Date()
    this.index = index

  }

  earnExp(exp) {
    this.exp += exp
  }

  canLevelUp() {
    return this.expCap <= this.exp
  }

  levelUp() {
    this.level += 1
    this.exp = 0
    this.expCap = expCap(this.level)
    this.health = 90 + 10 * this.level
    this.attack = 10 + this.level
  }

  damage(damage) {
    this.health -= damage
  }

  isDead() {
    return this.state === 'dead'
  }

  die() {
    this.level = this.level > 1 ? this.level - 1 : 1
    this.location = this.respawnLocation
    this.health = 0
    this.expCap = expCap(this.level)
    this.health = 90 + 10 * this.level
    this.attack = 9 + this.level
    this.state = 'dead'

    spawnTimer.add(this, CHARACTER_RESPAWN_DURATION)
  }

  spawn() {
    this.state = 'alive' || this.health <= 0
  }

  isNextTo(location) {
    const deltaX = this.location.x - location.x
    const deltaY = this.location.y - location.y
    if (deltaX === 0 && deltaY === 0) {
      return false
    }
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)
    if (absDeltaX === 1 && absDeltaY === 0) {
      return true
    }
    return absDeltaX === 0 && absDeltaY === 1
  }

  isAnimatable(time) {
    return (time - this.lastAnimation) > ANIMATE_DURATION * 1000
  }

  updateLastAnimation(time) {
    this.lastAnimation = time
  }

  heal() {
    const maxHealth = 90 + 10 * this.level
    this.health += healAmount()
    if (this.health > maxHealth) {
      this.health = maxHealth
    }
  }
}

module.exports = Character
