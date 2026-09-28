require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT id, full_name, email, phone, role, is_active, failed_login_count, locked_at, last_login_at FROM users LIMIT 20`);
    console.log('users count', rows.length);
    rows.forEach(row => console.log(row));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
