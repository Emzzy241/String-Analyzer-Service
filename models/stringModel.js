import mongoose from "mongoose"
import crypto from "node:crypto"



const stringProperties = {}

function isPalindrome(sentence) {
    let strArrayReversed = sentence.toLowerCase().split("").reverse().join("")
    if (sentence === strArrayReversed) {
        console.log("String Entered is a palindrome")
        return true
    }
    else {
        console.log("String entered is not a palindrome")
        return false
    }
}

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


const stringSchema = mongoose.Schema({
    value: {
        type: String,
        required: true,
        trim: true
    },
    properties: {
        length: { type: Number, default: 0 },
        is_palindrome: { type: Boolean, default: false },
        unique_characters: { type: Number, default: 0 },
        word_count: { type: Number, default: 0 },
        sha256_hash: { type: String, default: "" },
        character_frequency_map: { type: Object, default: {} }
    }
}, {
    timestamps: true
})

// Computing properties before saving to database
stringSchema.pre('save', function (next) {
    if (!this.isModified('value')) return next()
    const val = this.value || ""
    this.properties = {
        length: val.length,
        is_palindrome: isPalindrome(val),
        unique_characters: countUniqueCharacters(val),
        word_count: wordCounter(val),
        sha256_hash: sha256Hash(val),
        character_frequency_map: characterFrequencyMap(val)
    }

    next()
})

const StringModel = mongoose.model('StringModel', stringSchema)

export default StringModel