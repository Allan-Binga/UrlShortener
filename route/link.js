const express = require("express")
const { shortLink } = require("../controller/link")

const router = express.Router()

router.post("/", shortLink)

module.exports = router