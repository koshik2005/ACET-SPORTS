import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "api", ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

console.log("Testing connection to:", MONGODB_URI ? "URI found" : "URI MISSING");

const stateSchema = new mongoose.Schema({
    houses: Array,
}, { strict: false });

const State = mongoose.model("State", stateSchema);

async function test() {
    try {
        console.log("Connecting...");
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ Connected!");

        const doc = await State.findOne();
        if (doc) {
            console.log("✅ State document found!");
            console.log("Houses count:", doc.houses?.length || 0);
            console.log("Registrations count:", doc.registrations?.length || 0);
            console.log("StudentsDB count:", doc.studentsDB?.length || 0);
        } else {
            console.log("❌ NO STATE DOCUMENT FOUND IN DATABASE!");
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("❌ CONNECTION ERROR:", err.message);
    }
}

test();
