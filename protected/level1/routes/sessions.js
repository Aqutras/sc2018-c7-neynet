const express = require('express')
const router = express.Router()

const Users = require('../src/users')

router.post('/', (req, res, _next) => {
    const name = req.body.name
    const password = req.body.password

    if (!name) {
        res.json({ status: 'error', reason: "user not found" })
    }
    if (Users.authenticate(name, password)) {
        const index = Users.IDS.indexOf(name)
        res.json({ status: 'success', data: { id: Users.IDS[index] } })

    } else {
        res.json({status: 'error', reason: "user not found" })
    }
})

module.exports = router
