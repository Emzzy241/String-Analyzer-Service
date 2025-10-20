import cors from "cors";
import express from "express";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
// Note: We assume StringModel.js and utils/StringAnalyzer.js are in place.
import StringModel from "./models/stringModel.js"; 
// import { fetch } from 'node-fetch'; // Required for LLM call in Endpoint 4

dotenv.config();

// --- LLM API Configuration for Natural Language Filtering (Endpoint 4) ---
// Note: In local environments, the key must be set in your .env file.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// Optional warning for local testing outside Canvas
if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing. Endpoint 4 may fail outside the Canvas environment without a valid key.");
}

const app = express();
const PORT = process.env.PORT || 8001;

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- Database Connection ---
try {
    mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected!!!");
} catch (error) {
    console.log(error);
}

// --- Helper Functions ---

/**
 * Executes a query against the StringModel and returns the formatted response.
 * This is used by both Endpoint 3 and Endpoint 4.
 * @param {object} query - The Mongoose query object.
 * @param {object} filtersApplied - Filters interpreted from the query parameters.
 * @param {object} res - Express response object.
 * @param {boolean} isNaturalLanguage - Flag to adjust response structure for Endpoint 4.
 */
const executeQueryAndRespond = async (query, filtersApplied, res, isNaturalLanguage = false) => {
    try {
        const data = await StringModel.find(query); // Find all matching documents
        
        // Map to ensure 'id' is present (from virtual property in StringModel)
        const formattedData = data.map(doc => doc.toObject());
        
        // Response structure for Endpoint 3 (Standard Filtering)
        let responseBody = {
            data: formattedData,
            count: formattedData.length,
            filters_applied: filtersApplied,
        };

        // Response structure for Endpoint 4 (Natural Language Filtering)
        if (isNaturalLanguage) {
             responseBody = {
                data: formattedData,
                count: formattedData.length,
                interpreted_query: filtersApplied
            };
        }
        
        res.status(200).json(responseBody);

    } catch (error) {
        console.error("Error executing query:", error);
        res.status(500).json({ error: 'Server Error: Could not fetch strings.' });
    }
};

// --- Endpoints ---

// 1. Create/Analyze String (POST /strings)
app.post("/strings", async (req, res) => {
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ success: false, error: 'Missing "value" field in request body.' });
    }
    if (typeof value !== 'string') {
        return res.status(422).json({ success: false, error: '"value" must be a string.' });
    }

    try {
        const properties = analyzeString(value);
        const hash = properties.sha256_hash;

        const existingString = await StringModel.findById(hash);
        if (existingString) {
            return res.status(409).json({ 
                error: "String already exists in the system", 
                id: hash 
            });
        }
        
        const newStringDoc = await StringModel.create({
            _id: hash, 
            value,
            properties,
            created_at: new Date().toISOString()
        });
        
        const responseData = newStringDoc.toObject();
        
        res.status(201).json({ 
            id: responseData.id,
            value: responseData.value,
            properties: responseData.properties,
            created_at: responseData.created_at,
        });

    } catch (error) {
        console.error("Error creating string:", error);
        res.status(500).json({ status: false, error: 'Server Error: Failed to create or analyze string.' });
    }
});


// 3. Get All Strings with Filtering (GET /strings?filters...)
app.get("/strings", async (req, res) => {
    const filters = req.query;
    const mongoQuery = {};
    const filtersApplied = {};

    // Helper function to validate and set filters
    const parseFilter = (key, type, validateFn = (v) => true) => {
        const value = filters[key];
        if (value !== undefined) {
            filtersApplied[key] = value;
            if (!validateFn(value)) {
                 throw new Error(`Invalid type or value for ${key}. Expected ${type}.`);
            }
            return value;
        }
        return null;
    };

    try {
        // is_palindrome: boolean (must be 'true' or 'false')
        const isPalindrome = parseFilter('is_palindrome', 'boolean', (v) => v === 'true' || v === 'false');
        if (isPalindrome !== null) {
            mongoQuery['properties.is_palindrome'] = (isPalindrome === 'true');
        }

        // min_length: integer
        const minLength = parseFilter('min_length', 'integer', (v) => !isNaN(parseInt(v)) && parseInt(v) >= 0);
        if (minLength !== null) {
            const numVal = parseInt(minLength);
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $gte: numVal };
        }

        // max_length: integer
        const maxLength = parseFilter('max_length', 'integer', (v) => !isNaN(parseInt(v)) && parseInt(v) >= 0);
        if (maxLength !== null) {
            const numVal = parseInt(maxLength);
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $lte: numVal };
        }
        
        // word_count: integer (exact match)
        const wordCount = parseFilter('word_count', 'integer', (v) => !isNaN(parseInt(v)) && parseInt(v) >= 0);
        if (wordCount !== null) {
            mongoQuery['properties.word_count'] = parseInt(wordCount);
        }

        // contains_character: string (single character to search for)
        const containsChar = parseFilter('contains_character', 'string', (v) => typeof v === 'string' && v.length === 1);
        if (containsChar !== null) {
             // Case-insensitive search on the original string value
            mongoQuery['value'] = { $regex: containsChar, $options: 'i' }; 
        }
        
        // Check for conflicting length filters
        if (minLength !== null && maxLength !== null && parseInt(minLength) > parseInt(maxLength)) {
             throw new Error(`min_length (${minLength}) cannot be greater than max_length (${maxLength}).`);
        }

    } catch (error) {
        console.error("Filter validation error:", error.message);
        return res.status(400).json({ error: "Bad Request: " + error.message, filters_applied: filtersApplied });
    }

    // Execute the query with the constructed filters
    await executeQueryAndRespond(mongoQuery, filtersApplied, res);
});


// 4. Natural Language Filtering (GET /strings/filter-by-natural-language) - FINAL IMPLEMENTATION
// MOVED UP to avoid conflict with Endpoint 2 (/strings/:hashValue)
app.get("/strings/filter-by-natural-language", async (req, res) => {
    const userQuery = req.query.query;

    if (!userQuery) {
        return res.status(400).json({ error: 'Missing "query" parameter for natural language filtering.' });
    }
    
    // 1. Define the JSON schema for the desired filter output
    const filterSchema = {
        type: "OBJECT",
        properties: {
            is_palindrome: { type: "BOOLEAN", description: "Set to true if the query mentions palindromes. Set to false otherwise." },
            min_length: { type: "INTEGER", description: "The minimum required length of the string, parsed from phrases like 'longer than 10'. For 'longer than X', set min_length to X+1." },
            max_length: { type: "INTEGER", description: "The maximum required length of the string, parsed from phrases like 'shorter than 50'. For 'shorter than X', set max_length to X-1." },
            word_count: { type: "INTEGER", description: "The exact number of words required, parsed from phrases like 'single word' or 'three words'." },
            contains_character: { type: "STRING", description: "A single character (lowercase) mentioned in the query, such as 'a', 'z', or 'first vowel'." },
        },
        description: "Parse a natural language query into a structured set of string filters. Only include fields explicitly mentioned or strongly implied by the query."
    };

    // 2. Define the system instruction for the LLM
    const systemInstruction = `You are a filter interpretation engine. Analyze the user's request and convert it into a structured JSON object that maps directly to the database query parameters. 
    Instructions: 
    1. Only include parameters in the JSON that are explicitly requested or clearly implied. 
    2. Convert numerical values to integers. 
    3. Interpret phrases like 'first vowel' to the character 'a'.
    4. Handle strict length requirements: 'longer than X' means min_length=X+1, and 'shorter than X' means max_length=X-1. 'at least X' means min_length=X. 'up to X' means max_length=X.
    5. Always return a valid JSON object matching the provided schema.`;

    // 3. Construct the LLM API payload
    const payload = {
        contents: [{ parts: [{ text: `Analyze this filter query: "${userQuery}"` }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: filterSchema
        }
    };

    let parsedFilters = {};
    try {
        // 4. Call the Gemini API to parse the query
        // Implementing exponential backoff logic for robust API call
        let apiResponse;
        let delay = 1000;
        const maxRetries = 3;

        for (let i = 0; i < maxRetries; i++) {
            apiResponse = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (apiResponse.ok) {
                break;
            }

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                 throw new Error(`LLM API failed after ${maxRetries} retries.`);
            }
        }
        
        const result = await apiResponse.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) {
            return res.status(400).json({ error: "Unable to parse natural language query: LLM output was empty." });
        }
        
        // 5. Parse the LLM's JSON response
        parsedFilters = JSON.parse(jsonText);
        
    } catch (llmError) {
        console.error("LLM or JSON parsing error:", llmError.message);
        return res.status(400).json({ error: "Unable to parse natural language query. Check query format or server logs." });
    }

    // 6. Apply the parsed filters to the Mongoose query
    const mongoQuery = {};
    const effectiveFilters = {};

    try {
        const { is_palindrome, min_length, max_length, word_count, contains_character } = parsedFilters;

        // Apply is_palindrome
        if (is_palindrome !== undefined) {
            if (typeof is_palindrome !== 'boolean') throw new Error("is_palindrome must be boolean.");
            mongoQuery['properties.is_palindrome'] = is_palindrome;
            effectiveFilters.is_palindrome = is_palindrome;
        }

        // Apply length filters
        if (min_length !== undefined) {
             if (typeof min_length !== 'number') throw new Error("min_length must be integer.");
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $gte: min_length };
            effectiveFilters.min_length = min_length;
        }
        if (max_length !== undefined) {
             if (typeof max_length !== 'number') throw new Error("max_length must be integer.");
            mongoQuery['properties.length'] = { ...mongoQuery['properties.length'], $lte: max_length };
            effectiveFilters.max_length = max_length;
        }
        
        // Apply word_count
        if (word_count !== undefined) {
             if (typeof word_count !== 'number') throw new Error("word_count must be integer.");
            mongoQuery['properties.word_count'] = word_count;
            effectiveFilters.word_count = word_count;
        }

        // Apply contains_character
        if (contains_character) {
             if (typeof contains_character !== 'string' || contains_character.length !== 1) throw new Error("contains_character must be a single character string.");
            mongoQuery['value'] = { $regex: contains_character, $options: 'i' };
            effectiveFilters.contains_character = contains_character;
        }

        // Check for conflicting filters (422 Unprocessable Entity)
        if (min_length !== undefined && max_length !== undefined && min_length > max_length) {
            return res.status(422).json({ 
                error: "Query parsed but resulted in conflicting filters (min_length > max_length).", 
                interpreted_query: { original: userQuery, parsed_filters: parsedFilters } 
            });
        }

    } catch (parsingError) {
        console.error("Error applying parsed filters:", parsingError.message);
        return res.status(400).json({ error: "Bad Request: LLM output contained invalid filter types.", interpreted_query: { original: userQuery, parsed_filters: parsedFilters } });
    }


    // 7. Execute the query and respond (pass true for isNaturalLanguage)
    await executeQueryAndRespond(mongoQuery, { original: userQuery, parsed_filters: effectiveFilters }, res, true);
});


// 2. Get Specific String (GET /strings/{sha256_hash})
// MOVED DOWN to ensure specific routes like /strings/filter-by-natural-language are caught first.
app.get("/strings/:hashValue", async (req, res) => {
    const hashValue = req.params.hashValue;

    try {
        const stringData = await StringModel.findById(hashValue);

        if (!stringData) {
            return res.status(404).json({ success: false, message: "String not found." });
        }

        const responseData = stringData.toObject();

        return res.status(200).json({
            id: responseData.id,
            value: responseData.value,
            properties: responseData.properties,
            created_at: responseData.created_at,
        });

    } catch (error) {
        console.error("Error fetching string:", error);
        res.status(500).json({ status: false, error: 'Server Error: Could not fetch string.' });
    }
});


// 5. Delete String (DELETE /strings/{sha256_hash})
app.delete("/strings/:hashValue", async (req, res) => {
    try {
        const hashValue = req.params.hashValue;
        
        const existingString = await StringModel.findByIdAndDelete(hashValue); 

        if (!existingString) {
            return res.status(404).json({ success: false, message: "String not found." });
        }

        return res.status(204).send();
        
    } catch (error) {
        console.error("Failed to delete the string:", error);
        return res.status(500).json({ success: false, message: 'Server Error: Could not delete string.' });
    }
});


// ROOT check
app.get("/", (req, res) => {
    res.send("Welcome to Project_1's String Analyzer Service.");
});


// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`\nApp is running on PORT: ${PORT}`);
    console.log("Project 1 String Analyzer Service is operational.");
});
