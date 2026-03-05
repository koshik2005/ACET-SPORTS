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
    athleticsList: { type: Array, default: [] },
    authorityRoles: { type: Array, default: [] },
    managementRoles: { type: Array, default: [] },
    nav: { type: Array, default: [] },
    eventDate: { type: Object, default: { date: "", time: "" } },
    emptyGame: { type: Object, default: {} },
}, {
    timestamps: true,
    // This ensures that Mongoose doesn't strip out fields not explicitly defined in the schema if we decide to add more later
    strict: false
});

const State = mongoose.model("State", stateSchema);

export default State;
