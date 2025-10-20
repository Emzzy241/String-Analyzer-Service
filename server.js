import cors from "cors"
import express from "express"
import * as dotenv from "dotenv"
import mongoose, { mongo } from "mongoose"
import { createStringSchema } from "./middlewares/validator.js"
import StringModel from "./models/stringModel.js"

dotenv.config()


const app = express()

//////////////////////////

const stringProperties = {}

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// })


function countUniqueCharacters(sentence) {
    const uniqueCharacters = new Set(sentence)

    return uniqueCharacters.size
}

function wordCounter(sentence) {
    let amountOfWords = 0;
    sentence.split(" ").forEach(word => {
        amountOfWords++
    })
    return amountOfWords
}

function sha256Hash(sentence) {
    return crypto.createHash('sha256').update(sentence).digest('hex')
}

function characterFrequencyMap(sentence) {
    // A function that takes in a sentence and returns all characters there and creates some form of object and maps every character to the no of occurrence in that sentence
    const characterCounts = {}

    for (const char of sentence) {
        characterCounts[char] = (characterCounts[char] || 0) + 1
    }

    return characterCounts
}

/////////////////////

app.use(express.json())
// Middleware to parse URL-encoded bodies (for form data)
// The 'extended: true' option allows for rich objects and arrays to be encoded into the URL-encoded format
app.use(express.urlencoded({ extended: true }))

app.use(cors())

// Project_1
const PORT = 8001

try {
    mongoose.connect(process.env.MONGO_URI)
    console.log("Database connected!!!")
} catch (error) {
    console.log(error)
}

app.listen(PORT || "8001", () => {
    console.log("App is running on PORT: 8001")
    console.log("Project 1!!!!!!!!!!!!!!")
})

app.post("/strings", async (req, res) => {
    console.log(req.body)
    const { value } = req.body

    try {
        const { error, schemaValue } = createStringSchema.validate({
            value
        })

        console.log(value)

        if (error) {
            return res.status(401).json({ success: false, error: error.details[0].message })
        }

        const newStringValue = await StringModel.create({
            value
        })

        res.status(201).json({ success: true, message: "String has been created", data: newStringValue })
    } catch (error) {
        console.log(error)
    }
})

app.get("/strings", async (req, res) => {
    try {
        const result = await StringModel.find()
        res.status(200).json({ success: true, message: "All Strings In Database", data: result})
    } catch (error) {
        console.log(error.message)
    }
})

app.get("/strings/:id", async (req, res) => {
    // console.log(id)
    try {
        const stringId = req.params.id
        const stringData = await StringModel.findById(stringId)

        if (!stringId) {
            console.log("No String ID was inputted")
            return res.status(400).json({ status: false, message: "No String ID was inputted" })
        }

        if (!stringData) {
            return res.status(404).json({ success: false, message: "Could not find a String with that ID" })
        }

        return res.status(200).json({ success: true, message: "The String with that ID has been gotten successfully", data: stringData })
    } catch (error) {
        console.error("There was an Error fetching the String", error)

        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, error: 'Invalid String ID format' })
        }
        res.status(500).json({ status: false, error: 'Server Error: Could not fetch String.' })
    }
})

app.delete("/strings/:id", async (req, res) => {
    try {
        const stringId = req.params.id
        const existingString = await StringModel.findById(stringId)

        if (!stringId) {
            console.log("No String ID was inputted")
            return res.status(400).json({ success: false, message: "No String ID was inputted"})
        }
        if (!existingString) {
            return res.status(404).json({ success: false, message: "Could not find a String with that ID"})
        }

        await existingString.deleteOne({ stringId })
        return res.status(204).json({ success: true, message: "String has been deleted successfully"})
        
    } catch (error) {
        console.log("Failed to delete the string with that ID")
        return res.status(400).json({ success: false, message: error})
    }
})


app.get("/", async (req, res) => {
    res.send("Welcome to Project_1's app")
})

// Who says this project should linger until tomorrow, when it can be completed today, right about now.