import express from "express"
import * as dotenv from "dotenv"

dotenv.config()

const app = express()

// Project_1
const PORT = 8001

app.listen(PORT || "8001", () => {
    console.log("App is running on PORT: 8001")
    console.log("Project 1!!!!!!!!!!!!!!")
})


app.get("/", async (req, res) => {
    res.send("Welcome to Project_1's app")
})

// Of course since it is  a string analyzer, it has to take in strings before it can even be able to analyze any string.

// app.get("/analyzer", async (req, res) => {
//     res.send()
// })