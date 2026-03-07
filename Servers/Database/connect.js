const mongoose = require("mongoose");

async function connectMongo() {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log("Database connected at", conn.connection.host);
    } catch (err) {
        console.log("MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = connectMongo;