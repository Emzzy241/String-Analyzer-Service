import readline from "node:readline"
import crypto from "node:crypto"



console.log("Please enter in a string")

const stringProperties = {}
// let stringToAnalyze = ""

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function countUniqueCharacters (sentence) {
    const uniqueCharacters = new Set(sentence)

    return uniqueCharacters.size
}

function wordCounter (sentence) {
    let amountOfWords = 0;
    sentence.split(" ").forEach(word => {
        amountOfWords++
    })
    return amountOfWords
}

function sha256Hash(sentence) {
    return crypto.createHash('sha256').update(sentence).digest('hex')
}

rl.question(`What is your sentence? `, sentence => {
    console.log(`Hi ${sentence}`)
    stringProperties.length = sentence.length
    console.log(sentence.length)
    
    // let strArray = sentence.toLowerCase().split("")
    let strArrayReversed = sentence.toLowerCase().split("").reverse().join("")

    console.log(sentence)
    console.log(strArrayReversed)

    if (sentence === strArrayReversed) {
        console.log("String Entered is a palindrome")
        stringProperties.is_palindrome = true
    }
    else {
        console.log("String entered is not a palindrome")
        stringProperties.is_palindrome = false
    }
    // let uniqueChars = countUniqueCharacters(sentence)
    // console.log(uniqueChars)
    stringProperties.unique_characters = countUniqueCharacters(sentence)

    stringProperties.word_count = wordCounter(sentence)

    stringProperties.sha256_hash = sha256Hash(sentence)



    console.log(stringProperties)
    rl.close()
})
