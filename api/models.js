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
    emptyGame: { type: Object, default: {} },
}, {
    timestamps: true,
    // This ensures that Mongoose doesn't strip out fields not explicitly defined in the schema if we decide to add more later
    strict: false
});

const State = mongoose.model("State", stateSchema);

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    type: { type: String, default: "student" }, // student or admin
    createdAt: { type: Date, default: Date.now, expires: 300 } // Auto-delete after 5 mins
});

const Otp = mongoose.model("Otp", otpSchema);

export { State, Otp };
export default State;
