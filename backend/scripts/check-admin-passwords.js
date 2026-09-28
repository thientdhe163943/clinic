require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  try {
    const email = 'admin@clinic.vn';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('admin not found');
      return;
    }
    const hash = user.password_hash || user.passwordHash;
    console.log('Testing hash for', email);
    const candidates = [
      'Password@123',
      'password',
      'admin',
      'Admin@123',
      'Admin123!',
      'admin@clinic.vn',
      'clinic@123',
      'Pa$$w0rd',
      'P@ssw0rd',
      'Admin@2024'
    ];
    for (const p of candidates) {
      try {
        const ok = await bcrypt.compare(p, hash);
        console.log(p, '=>', ok);
      } catch (e) {
        console.error('bcrypt error', e.message);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
