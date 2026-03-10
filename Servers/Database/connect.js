const mongoose = require("mongoose");

async function connectMongo() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not set in environment variables.");
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("MongoDB connected");
    } catch (err) {
        console.log("MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = connectMongo;
