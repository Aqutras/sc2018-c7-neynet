const expCalc = (attacker, target) => {
    switch (target.constructor.name) {
        case 'Minion': {
            return 5
        }
        case 'Character': {
            const delta = target.level - attacker.level
            return target.level * 5 + Math.round(delta) + 5
        }
        default: {
            console.warn('unreachable arm')
            return 0
        }
    }
}

module.exports = expCalc
