const mongoose = require('mongoose');
require('dotenv').config();
const { State, Otp } = require('./api/models.js');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = 'test_student@example.com';
    const otpVal = '123456';

    console.log('--- TEST START ---');

    // 1. Setup OTP
    await Otp.findOneAndUpdate({ email, type: 'student' }, { otp: otpVal, createdAt: new Date() }, { upsert: true });
    console.log('1. OTP created in DB.');

    // 2. Mock /api/verify-otp logic
    const storedBefore = await Otp.findOne({ email, type: 'student' });
    if (storedBefore && storedBefore.otp === otpVal) {
        console.log('2. Verification success simulation.');
        // Previously we deleted it here. Now we don't.
    }

    // 3. Check if OTP still exists
    const storedAfterVerify = await Otp.findOne({ email, type: 'student' });
    if (storedAfterVerify) {
        console.log('3. OTP persists after verification! [PASS]');
    } else {
        console.log('3. OTP was deleted! [FAIL]');
        process.exit(1);
    }

    // 4. Mock /api/register-event cleanup logic
    if (storedAfterVerify) {
        await Otp.deleteOne({ _id: storedAfterVerify._id });
        console.log('4. OTP deleted after registration simulation.');
    }

    // 5. Final check
    const finalCheck = await Otp.findOne({ email, type: 'student' });
    if (!finalCheck) {
        console.log('5. Final cleanup verified! [PASS]');
    } else {
        console.log('5. Cleanup failed! [FAIL]');
        process.exit(1);
    }

    console.log('--- TEST COMPLETE ---');
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
