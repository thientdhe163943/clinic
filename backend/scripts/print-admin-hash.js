require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@clinic.vn' } });
    if (!user) {
      console.log('admin@clinic.vn not found');
      return;
    }
    console.log('email:', user.email);
    console.log('hash:', user.password_hash || user.passwordHash);
    console.log('failedLoginCount:', user.failed_login_count ?? user.failedLoginCount);
    console.log('lockedAt:', user.locked_at ?? user.lockedAt);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
