import readline from "node:readline"


console.log("Please enter in a string")

const stringProperties = {}
// let stringToAnalyze = ""

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function countUniqueCharacters (str) {
    const uniqueCharacters = new Set(str)

    return uniqueCharacters.size
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

    let wordCounter = 0;

    sentence.split(" ").forEach(word => {
        wordCounter++
    });
    console.log(wordCounter)

    stringProperties.word_count = wordCounter

    console.log(stringProperties)
    rl.close()
})
