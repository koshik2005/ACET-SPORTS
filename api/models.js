import mongoose from "mongoose";

const stateSchema = new mongoose.Schema({
    houses: { type: Array, default: [] },
    authorities: { type: Array, default: [] },
    management: { type: Array, default: [] },
    studentCommittee: { type: Array, default: [] },
    games: { type: Array, default: [] },
    gallery: { type: Array, default: [] },
    registrations: { type: Array, default: [] },
    pointLog: { type: Array, default: [] },
    studentsDB: { type: Array, default: [] },
    results: { type: Array, default: [] },
    sportGamesList: { type: Array, default: [] },
    sportGamesListWomens: { type: Array, default: [] },
    staffGamesList: { type: Array, default: [] },
    staffGamesListWomens: { type: Array, default: [] },
    athleticsList: { type: Array, default: [] },
    athleticsListWomens: { type: Array, default: [] },
    authorityRoles: { type: Array, default: [] },
    managementRoles: { type: Array, default: [] },
    nav: { type: Array, default: [] },
    registrationOpen: { type: Boolean, default: true },
    eventDate: { type: Object, default: { date: "", time: "" } },
    inaugurationDetails: { type: Object, default: { date: "", time: "", venue: "" } },
    emptyGame: { type: Object, default: {} },
    starPlayers: { type: Array, default: [] },
    closedEvents: { type: Array, default: [] },
    maxGames: { type: Number, default: 1 },
    maxAthletics: { type: Number, default: 1 },
    adminLogs: { type: Array, default: [] },
    launchConfig: { type: Object, default: { enabled: true, title: "Achariya Sports Day", year: "2026", released: false } },
    memorial: { type: Object, default: { enabled: false, list: [] } },
    commonGamesMen: { type: Array, default: [] },
    commonAthleticsMen: { type: Array, default: [] },
    commonGamesWomen: { type: Array, default: [] },
    commonAthleticsWomen: { type: Array, default: [] },
    about: { type: Object, default: { sponsors: [], credits: "" } },
}, {
    timestamps: true,
    strict: false
});

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    type: { type: String, default: "student" }, // student or admin
    createdAt: { type: Date, default: Date.now, expires: 300 }
});

const querySchema = new mongoose.Schema({
    regNo: { type: String, required: true },
    studentName: { type: String, required: true },
    issueType: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, default: "Pending" },
    createdAt: { type: Date, default: Date.now }
});

const invalidatedTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 }
});

const State = mongoose.models.State || mongoose.model("State", stateSchema);
const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
const Query = mongoose.models.Query || mongoose.model("Query", querySchema);
const InvalidatedToken = mongoose.models.InvalidatedToken || mongoose.model("InvalidatedToken", invalidatedTokenSchema);

export { State, Otp, Query, InvalidatedToken };
export default State;
