import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import fetch from 'node-fetch';

// Local Imports
import StringModel from './models/stringModel.js';
import { analyzeString } from './utils/StringAnalyzer.js';

// --- CONFIGURATION ---
import 'dotenv/config'; 
const PORT = process.env.PORT || 8001;
const MONGO_URI = process.env.MONGO_URI;

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Initialize Express App
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json()); // Essential for parsing POST request bodies

// --- DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Database connected!!!'))
    .catch((err) => console.error('Database connection error:', err));


// --- HELPER FUNCTIONS ---

/**
 * Custom error handler for all routes.
 * @param {object} res - Express response object.
 * @param {number} statusCode - HTTP status code.
 * @param {string} message - Error message.
 * @param {object} [error] - Original error object for logging.
 */
const handleError = (res, statusCode, message, error) => {
    if (error) {
        console.error(`[Error ${statusCode}] ${message}:`, error);
    }
    res.status(statusCode).json({
        status: 'error',
        message: message
    });
};

/**
 * Executes a MongoDB query and formats the response according to API specifications.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {object} query - Mongoose query object.
 * @param {object} filters - Object containing applied filters for the response body.
 */
const executeQueryAndRespond = async (req, res, query, filters) => {
    try {
        const results = await query.exec();
        
        // Map the results to the required API format (using 'id' instead of '_id')
        const formattedData = results.map(doc => ({
            id: doc.id,
            value: doc.value,
            properties: doc.properties,
            created_at: doc.created_at
        }));

        res.status(200).json({
            data: formattedData,
            count: formattedData.length,
            filters_applied: filters
        });
    } catch (error) {
        handleError(res, 500, "There was an Error fetching strings.", error);
    }
};

/**
 * Safely parses and validates query parameters for filtering.
 * @param {string} value - The query parameter value.
 * @param {string} type - 'boolean', 'integer', or 'string'.
 * @param {string} name - The parameter name.
 * @returns {any} The parsed value or null if not provided.
 * @throws {Error} If validation fails.
 */
const parseFilter = (value, type, name) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (type === 'boolean') {
        const lowerCaseValue = value.toLowerCase();
        if (lowerCaseValue === 'true') return true;
        if (lowerCaseValue === 'false') return false;
        throw new Error(`Invalid boolean value for ${name}. Must be 'true' or 'false'.`);
    }

    if (type === 'integer') {
        const num = parseInt(value, 10);
        if (isNaN(num)) {
            throw new Error(`Invalid integer value for ${name}.`);
        }
        return num;
    }

    if (type === 'string' && value.length > 1) {
        throw new Error(`Invalid string value for ${name}. Must be a single character.`);
    }

    return value;
};


// --- ENDPOINTS ---

app.get("/", (req, res) => {
    res.send("Project 1 String Analyzer Service is operational.");
});

// Endpoint 1: POST /strings - Create a new string
app.post("/strings", async (req, res) => {
    try {
        const { value } = req.body;
        
        // --- 400 Bad Request Check: Missing 'value' ---
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
            return handleError(res, 400, "Invalid input: 'value' field is required and must be a non-empty string.");
        }
        
        const stringToAnalyze = value.trim();
        const analysis = analyzeString(stringToAnalyze);
        const { sha256_hash, ...props } = analysis;
        
        // Prepare the document
        const newStringData = {
            _id: sha256_hash, // Use the hash as the unique MongoDB ID
            value: stringToAnalyze,
            properties: props, // contains length, word_count, is_palindrome
            created_at: new Date().toISOString()
        };

        // --- 409 Conflict Check: Duplicate String ---
        const existingString = await StringModel.findById(sha256_hash);
        if (existingString) {
            // Return 409 Conflict if the string (hash) already exists
            return res.status(409).json({
                status: 'error',
                message: 'String already exists.',
                data: {
                    id: existingString.id,
                    value: existingString.value,
                    properties: existingString.properties,
                    created_at: existingString.created_at
                }
            });
        }
        
        // Save to database
        const createdString = await StringModel.create(newStringData);
        
        // --- 201 Success Response ---
        res.status(201).json({
            status: 'success',
            message: 'String created successfully.',
            data: {
                id: createdString.id,
                value: createdString.value,
                properties: createdString.properties,
                created_at: createdString.created_at
            }
        });
        
    } catch (error) {
        // Catch all other errors, including potential Mongoose validation errors
        // Note: The CastError for _id is solved by StringModel.js
        if (error.name === 'ValidationError') {
            return handleError(res, 400, `Validation failed: ${error.message}`, error);
        }
        handleError(res, 500, "Error creating string.", error);
    }
});

// Endpoint 4: GET /strings/filter-by-natural-language - Natural Language Filtering (SPECIFIC ROUTE - MUST COME FIRST)
app.get("/strings/filter-by-natural-language", async (req, res) => {
    const userQuery = req.query.query;
    if (!userQuery) {
        return handleError(res, 400, "Query parameter 'query' is required for natural language filtering.");
    }

    const systemPrompt = `You are a query parser for a string data API. Your task is to translate a natural language query into a strict JSON object of MongoDB filters. The available filters are: 
    1. 'is_palindrome': boolean (true/false)
    2. 'min_length': integer (minimum length, inclusive)
    3. 'max_length': integer (maximum length, inclusive)
    4. 'word_count': integer (exact word count)
    5. 'contains_character': string (single character to search for)

    You MUST only use these keys. Do not include any other text or explanation in your response. Analyze the user query and generate the JSON object based on the filters. If a filter is not specified, omit it. Resolve conflicting filters if possible (e.g., 'longer than 5 but shorter than 10' should result in both 'min_length' and 'max_length'). If you cannot parse the query or if the query contains contradictory filters that cannot be resolved (e.g., 'word count 3 and word count 5'), return an empty object {} in the JSON response.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "is_palindrome": { "type": "BOOLEAN" },
                    "min_length": { "type": "INTEGER" },
                    "max_length": { "type": "INTEGER" },
                    "word_count": { "type": "INTEGER" },
                    "contains_character": { "type": "STRING" }
                }
            }
        }
    };

    let parsedFilters = {};
    let errorDuringParsing = false;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const result = await response.json();
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (jsonText) {
                parsedFilters = JSON.parse(jsonText);
                break; // Success, break retry loop
            } else {
                throw new Error("Gemini response structure invalid or empty.");
            }
        } catch (error) {
            errorDuringParsing = true;
            console.error(`Attempt ${i + 1} failed for Gemini API:`, error.message);
            if (i < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, INITIAL_BACKOFF_MS * Math.pow(2, i)));
            }
        }
    }

    // Handle failure to parse (including if the AI returns an empty object indicating unparseable/contradictory)
    if (Object.keys(parsedFilters).length === 0 || errorDuringParsing) {
        return handleError(res, 400, "Unable to parse natural language query or query resulted in conflicting filters.");
    }
    
    // --- Build MongoDB Query ---
    const mongoQuery = {};
    const filtersApplied = {};

    for (const key in parsedFilters) {
        const value = parsedFilters[key];
        if (value === undefined || value === null) continue;

        filtersApplied[key] = value; // Store for response body

        if (key === 'is_palindrome') {
            mongoQuery['properties.is_palindrome'] = value;
        } else if (key === 'min_length') {
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $gte: value };
        } else if (key === 'max_length') {
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $lte: value };
        } else if (key === 'word_count') {
            mongoQuery['properties.word_count'] = value;
        } else if (key === 'contains_character') {
            // Case-insensitive regex search on the original string value
            mongoQuery['value'] = { $regex: value, $options: 'i' };
        }
    }

    const query = StringModel.find(mongoQuery);
    
    // Custom response format for this endpoint
    try {
        const results = await query.exec();
        
        const formattedData = results.map(doc => ({
            id: doc.id,
            value: doc.value,
            properties: doc.properties,
            created_at: doc.created_at
        }));

        res.status(200).json({
            data: formattedData,
            count: formattedData.length,
            interpreted_query: {
                original: userQuery,
                parsed_filters: filtersApplied
            }
        });
    } catch (error) {
        handleError(res, 500, "Database error during filtered search.", error);
    }
});


// Endpoint 3: GET /strings - Get all strings with filtering (LESS SPECIFIC THAN ENDPOINT 4)
app.get("/strings", async (req, res) => {
    const mongoQuery = {};
    const filtersApplied = {};

    try {
        const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;

        // 1. Palindrome Filter
        const parsedIsPalindrome = parseFilter(is_palindrome, 'boolean', 'is_palindrome');
        if (parsedIsPalindrome !== null) {
            mongoQuery['properties.is_palindrome'] = parsedIsPalindrome;
            filtersApplied.is_palindrome = parsedIsPalindrome;
        }

        // 2. Length Filters (min_length and max_length)
        const parsedMinLength = parseFilter(min_length, 'integer', 'min_length');
        const parsedMaxLength = parseFilter(max_length, 'integer', 'max_length');
        
        const lengthQuery = {};
        if (parsedMinLength !== null) {
            lengthQuery.$gte = parsedMinLength;
            filtersApplied.min_length = parsedMinLength;
        }
        if (parsedMaxLength !== null) {
            lengthQuery.$lte = parsedMaxLength;
            filtersApplied.max_length = parsedMaxLength;
        }
        if (Object.keys(lengthQuery).length > 0) {
            mongoQuery['properties.length'] = lengthQuery;
        }

        // 3. Word Count Filter
        const parsedWordCount = parseFilter(word_count, 'integer', 'word_count');
        if (parsedWordCount !== null) {
            mongoQuery['properties.word_count'] = parsedWordCount;
            filtersApplied.word_count = parsedWordCount;
        }

        // 4. Contains Character Filter
        const parsedContainsCharacter = parseFilter(contains_character, 'string', 'contains_character');
        if (parsedContainsCharacter !== null) {
            // Use case-insensitive regex search on the original string value
            mongoQuery['value'] = { $regex: parsedContainsCharacter, $options: 'i' };
            filtersApplied.contains_character = parsedContainsCharacter;
        }

        const query = StringModel.find(mongoQuery);
        await executeQueryAndRespond(req, res, query, filtersApplied);

    } catch (error) {
        handleError(res, 400, error.message);
    }
});

// Endpoint 2: GET /strings/:hashValue - Get a specific string by hash
app.get("/strings/:hashValue", async (req, res) => {
    const hashValue = req.params.hashValue;
    
    try {
        // Use findById as the hash is set as the _id field
        const stringDoc = await StringModel.findById(hashValue).exec();

        if (!stringDoc) {
            return handleError(res, 404, "String not found.");
        }

        res.status(200).json({
            status: 'success',
            data: {
                id: stringDoc.id,
                value: stringDoc.value,
                properties: stringDoc.properties,
                created_at: stringDoc.created_at
            }
        });
    } catch (error) {
        // Log the error for debugging, but return 404/500 to the client
        if (error.name === 'CastError') {
             // This handles cases where the hashValue is not a 64-character hex string
             // We treat non-matching format as Not Found for security/simplicity
            return handleError(res, 404, "String not found (Invalid hash format).");
        }
        handleError(res, 500, "There was an Error fetching the String.", error);
    }
});

// Endpoint 5: DELETE /strings/:hashValue - Delete a specific string by hash
app.delete("/strings/:hashValue", async (req, res) => {
    const hashValue = req.params.hashValue;
    
    try {
        const result = await StringModel.findByIdAndDelete(hashValue).exec();

        if (!result) {
            return handleError(res, 404, "String not found.");
        }

        // 204 No Content is ideal for successful deletion, but 200 OK with a message is also common.
        // We'll use 200 OK with success message for clarity.
        res.status(200).json({
            status: 'success',
            message: `String with ID ${hashValue} successfully deleted.`
        });

    } catch (error) {
        if (error.name === 'CastError') {
             // Treat non-matching format as Not Found
            return handleError(res, 404, "String not found (Invalid hash format).");
        }
        handleError(res, 500, "Error deleting string.", error);
    }
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`App is running on PORT: ${PORT}`);
    console.log("Project 1 String Analyzer Service is operational.");
});
