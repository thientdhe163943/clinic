require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  try {
    const emailsToCheck = ['admin@gmail.com', 'admin@clinic.vn'];
    for (const email of emailsToCheck) {
      const user = await prisma.user.findUnique({ where: { email } });
      console.log(`${email}:`, user ? 'found' : 'not found');
      if (user) {
      console.log({
        id: user.id,
        email: user.email,
        fullName: user.full_name || user.fullName,
        role: user.role,
        isActive: user.is_active ?? user.isActive,
        failedLoginCount: user.failed_login_count ?? user.failedLoginCount,
        lockedAt: user.locked_at ?? user.lockedAt,
        lastLoginAt: user.last_login_at ?? user.lastLoginAt,
      });
        const valid = await bcrypt.compare('Password@123', user.password_hash ?? user.passwordHash);
        console.log('Password@123 valid:', valid);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
