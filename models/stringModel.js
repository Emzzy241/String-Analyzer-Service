import mongoose from 'mongoose';

const stringSchema = new mongoose.Schema({
    // CRITICAL FIX: Explicitly define _id as a String.
    // This resolves the CastError. Mongoose now accepts the 64-character 
    // SHA-256 hash as the document's primary key without attempting to 
    // cast it to a standard 24-character ObjectId.
    _id: { 
        type: String, 
        required: true 
    },
    value: { 
        type: String, 
        required: true 
    },
    properties: {
        length: { type: Number, required: true },
        word_count: { type: Number, required: true },
        // The analysis data is calculated and included here.
        sha256_hash: { type: String, required: true },
        is_palindrome: { type: Boolean, required: true },
        // NOTE: Unique characters and character map are not required by the API specs (Endpoints 1-5), 
        // so they are omitted here for a clean model structure.
    },
    created_at: {
        type: String, 
        required: true 
    }
}, {
    // Schema Options
    // We set timestamps to false because we explicitly track 'created_at'.
    timestamps: false,
    // Enable virtuals for the ID field
    toJSON: { virtuals: true },
    toObject: { virtuals: true } 
});

// Define a virtual 'id' property that maps to the '_id' (the hash value).
// This is good practice for cleaner frontend interaction.
stringSchema.virtual('id').get(function () {
    return this._id;
});

const StringModel = mongoose.model('StringModel', stringSchema);

export default StringModel;




/*
    import mongoose from 'mongoose';

const stringSchema = new mongoose.Schema({
    // CRITICAL FIX: Explicitly define _id as a String.
    // This tells Mongoose not to try and cast the 64-character SHA-256 hash 
    // into a 24-character ObjectId.
    _id: { 
        type: String, 
        required: true 
    },
    value: { 
        type: String, 
        required: true 
    },
    properties: {
        length: { type: Number, required: true },
        word_count: { type: Number, required: true },
        sha256_hash: { type: String, required: true },
        is_palindrome: { type: Boolean, required: true },
    },
    created_at: {
        type: String, 
        required: true 
    }
}, {
    // Schema Options
    timestamps: false,
    // Enable virtuals for the ID field
    toJSON: { virtuals: true },
    toObject: { virtuals: true } 
});

// Define a virtual 'id' property that maps to the '_id' (the hash value).
// This is good practice for cleaner frontend interaction.
stringSchema.virtual('id').get(function () {
    return this._id;
});

const StringModel = mongoose.model('StringModel', stringSchema);

export default StringModel;

*/