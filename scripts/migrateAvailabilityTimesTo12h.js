require('dotenv').config();
const mongoose = require('mongoose');
const AvailabilityBlock = require('../Servers/Model/AvailabilityBlock');

function to12h(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
        return raw;
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return raw;
    }

    const meridiem = hours >= 12 ? 'PM' : 'AM';
    hours = ((hours + 11) % 12) + 1;

    return `${hours}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);

    const docs = await AvailabilityBlock.find({}, 'startTime endTime').lean();
    let updated = 0;

    for (const doc of docs) {
        const normalizedStart = to12h(doc.startTime);
        const normalizedEnd = to12h(doc.endTime);

        if (normalizedStart !== doc.startTime || normalizedEnd !== doc.endTime) {
            await AvailabilityBlock.updateOne(
                { _id: doc._id },
                { $set: { startTime: normalizedStart, endTime: normalizedEnd } }
            );
            updated += 1;
        }
    }

    console.log(`Availability blocks scanned: ${docs.length}`);
    console.log(`Availability blocks updated: ${updated}`);

    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // Ignore disconnect failures after fatal migration error.
    }
    process.exit(1);
});
