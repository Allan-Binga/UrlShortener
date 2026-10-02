const express = require("express")

//Import PG
const linkRoutes = require("./route/link")
const { redirectLink } = require("./controller/link")

//Initialize Express
const app = express()
app.use(express.json())
app.use("/api/links", linkRoutes)

//ROuting PAth
app.get("/api", (req, res) => {
    res.send("Hi there")
})

app.get("/:shortCode", redirectLink)


const PORT = 4500;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`)
    })
}

module.exports = app
