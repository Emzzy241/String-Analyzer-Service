## Project_1 HNG __ Stage 1 Task: String Analyzer Service
#### Developed by Mojiboye Emmanuel (Dynasty)

## Description
_This service is a robust RESTful API built with Node.js, Express, and MongoDB (via Mongoose). Its primary function is to accept a string, analyze it for key properties (length, word count, palindrome status, and a unique SHA-256 hash), store the results, and provide various endpoints for retrieval, filtering, and deletion._

_A key feature of this application is the Natural Language Filtering capability, which utilizes the Gemini API to parse complex user queries into structured database filters._

## Tools and Technologies
* _Javascript_
* _Backend: NodeJS,ExpressJS_
* _External API: Google Gemini API (for natural language processing)_
* _Database: MongoDB (via Mongoose)_

## Core Features & Endpoints

```sh
POST /strings

Creates and stores a new analyzed string.

Returns 201 on success, 409 on duplicate, 400 on invalid input.

```

```sh

GET /strings/:hashValue

Retrieves a specific string document by its unique SHA-256 hash ID.

Returns 200 on found, 404 on not found.

```

```sh

GET /strings

Retrieves all strings with optional query parameter filtering (e.g., ?is_palindrome=true).

Handles is_palindrome, min_length, max_length, word_count, contains_character.

```

```sh
GET /strings/filter-by-natural-language

Uses the Gemini API to interpret a plain English query and filter the results.

Accepts ?query=... parameter.

```

```sh

DELETE /strings/:hashValue

Removes a string document from the database using its hash ID.

Returns 200 on success, 404 on not found.

```

## Setup and Installation

### Prerequisites

1. Node.js (v18+)
2. npm
3. A running MongoDB instance (local or hosted, e.g., MongoDB Atlas)
4. A Google Gemini API Key

### Installation Steps

1. Clone the Repository:
```sh
git clone <your-repo-link>
cd <project-directory>
```

2. Install Dependencies:

```sh
npm install express mongoose cors dotenv node-fetch
```

3. Configuration (.env file):
Create a file named .env in the root of your project directory and add your credentials:

```sh
# MongoDB Connection String (e.g., from MongoDB Atlas)
MONGO_URI=mongodb+srv://<user>:<password>@<cluster-url>/<dbname>?retryWrites=true&w=majority

# Gemini API Key for Natural Language Processing
GEMINI_API_KEY=<Your_Gemini_API_Key_Here>
Visit: https://aistudio.google.com/api-keys

# Optional: Set the server port
PORT=8001 
```

4. Running the Server

```sh
Start the application using Node.js:

node server.js

```

The console should display:

```sh
Database connected!!!
App is running on PORT: 8001
Project 1 String Analyzer Service is operational.
```

## Known Bugs
_As at the Launch og this project, there are no known bugs in the application._

## Contact
_Twitter: @EmmanuelMojiboy_
_GitHub: Emzzy241_
_Linkedin: Emmanuel Oluwole Mojiboye_