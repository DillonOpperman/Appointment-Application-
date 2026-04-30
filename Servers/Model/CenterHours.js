const mongoose = require('mongoose');

const dayHoursSchema = new mongoose.Schema({
    open: { type: String, default: null },   // e.g. "9:00 AM"  — null means closed
    close: { type: String, default: null }   // e.g. "6:00 PM"
}, { _id: false });

const centerHoursSchema = new mongoose.Schema({
    // Singleton document — always update the same one
    sunday:    { type: dayHoursSchema, default: { open: null, close: null } },
    monday:    { type: dayHoursSchema, default: { open: '9:00 AM', close: '6:00 PM' } },
    tuesday:   { type: dayHoursSchema, default: { open: '9:00 AM', close: '6:00 PM' } },
    wednesday: { type: dayHoursSchema, default: { open: '9:00 AM', close: '6:00 PM' } },
    thursday:  { type: dayHoursSchema, default: { open: '9:00 AM', close: '6:00 PM' } },
    friday:    { type: dayHoursSchema, default: { open: '9:00 AM', close: '4:00 PM' } },
    saturday:  { type: dayHoursSchema, default: { open: null, close: null } }
}, { timestamps: true });

module.exports = mongoose.model('CenterHours', centerHoursSchema);
