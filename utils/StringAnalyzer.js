import crypto from 'crypto';

/**
 * Analyzes a string to calculate its core properties, including length, word count,
 * SHA-256 hash (used as the document ID), and palindrome status.
 * * @param {string} value The input string to analyze.
 * @returns {object} An object containing the calculated properties.
 */
export function analyzeString(value) {
    // 1. Calculate Length (Total number of characters)
    const length = value.length;

    // 2. Calculate Word Count
    // Use a regex to split by whitespace and filter out empty strings for accurate count
    const words = value.trim().split(/\s+/).filter(word => word.length > 0);
    const word_count = words.length;

    // 3. Calculate SHA-256 Hash (Used as the unique document ID in MongoDB)
    const sha256_hash = crypto.createHash('sha256').update(value).digest('hex');

    // 4. Check Palindrome status (Ignoring case and non-alphanumeric characters)
    // This allows for palindromes like "A man, a plan, a canal: Panama"
    const cleanedValue = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const reversedValue = cleanedValue.split('').reverse().join('');
    // A string is a palindrome only if it has content after cleaning
    const is_palindrome = cleanedValue.length > 0 && cleanedValue === reversedValue;

    return {
        length,
        word_count,
        sha256_hash,
        is_palindrome,
    };
}
