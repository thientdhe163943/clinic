require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT id, name, CONVERT(BINARY(CONVERT(name USING latin1)) USING utf8mb4) AS fixed_name FROM rooms LIMIT 5`);
    console.log('rooms conversion sample');
    rows.forEach((row) => {
      console.log('id:', row.id);
      console.log('name:', row.name);
      console.log('fixed_name:', row.fixed_name);
      console.log('---');
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
