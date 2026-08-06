require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { User } = require('./models');

const [,, email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.log('Usage: node reset-password.js <email> <new-password>');
  console.log('Example: node reset-password.js test@example.com myNewPass123');
  process.exit(1);
}

async function resetPassword() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  console.log('Password reset successful for:', user.email);
  process.exit(0);
}

resetPassword().catch(err => { console.error('Error:', err.message); process.exit(1); });
