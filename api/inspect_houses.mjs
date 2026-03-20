import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

const stateSchema = new mongoose.Schema({}, { strict: false });
const State = mongoose.model("State", stateSchema);

async function inspectHouses() {
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        const doc = await State.findOne();
        if (doc && doc.houses) {
            console.log("Houses config:", doc.houses.map(h => ({
                name: h.name,
                displayName: h.displayName,
                color: h.color
            })));
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error("❌ ERROR:", err.message);
    }
}

inspectHouses();
