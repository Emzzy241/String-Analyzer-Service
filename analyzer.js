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

function characterFrequencyMap (sentence) {
    // A function that takes in a sentence and returns all characters there and creates some form of object and maps every character to the no of occurrence in that sentence
    const characterCounts = {}

    for (const char of sentence) {
        characterCounts[char] = (characterCounts[char] || 0) + 1
    }

    return characterCounts
}

function countCharacterOccurrences(sentence) {
  const characterCounts = {}; // This object will store the character counts.

  // Loop through each character of the sentence.
  for (const char of sentence) {
    // If the character is already a key in our object, increment its value.
    // Otherwise, initialize the key with a value of 1.
    characterCounts[char] = (characterCounts[char] || 0) + 1;
  }

  return characterCounts;
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

    stringProperties.character_frequency_map = characterFrequencyMap(sentence)



    console.log(stringProperties)
    rl.close()
})
