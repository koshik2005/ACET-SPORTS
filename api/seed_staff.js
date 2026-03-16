
import mongoose from 'mongoose';
import { State } from './models.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const state = await State.findOne();
    if (!state) {
      console.log('State not found');
      return;
    }

    // Add Staff Games if empty
    if (state.staffGamesList.length === 0) {
      state.staffGamesList = ['Staff Cricket', 'Staff Badminton', 'Staff Volleyball'];
      console.log('Added Staff Games');
    }

    // Add Staff Member to studentsDB if not exists
    const staffEmail = 'staff@example.com';
    const hasStaff = state.studentsDB.find(s => s.email === staffEmail);

    if (!hasStaff) {
      state.studentsDB.push({
        name: 'Staff One',
        regNo: 'S001',
        email: staffEmail,
        gender: 'Male',
        house: 'RUBY',
        role: 'Staff'
      });
      console.log('Added Staff Member S001');
    } else {
      console.log('Staff member already exists');
      // Update role just in case
      const idx = state.studentsDB.findIndex(s => s.email === staffEmail);
      state.studentsDB[idx].role = 'Staff';
    }

    await state.save();
    console.log('State saved');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
