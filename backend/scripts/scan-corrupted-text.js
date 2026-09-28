require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const patterns = ['Ã', 'Â', 'Ä', 'áº', 'Áº', 'Ã¡', 'Æ'];
const columnsToScan = [
  { table: 'app_messages', column: 'message' },
  { table: 'rooms', column: 'name' },
  { table: 'rooms', column: 'description' },
  { table: 'specialties', column: 'name' },
  { table: 'specialties', column: 'description' },
  { table: 'doctor_profiles', column: 'degree' },
  { table: 'doctor_profiles', column: 'biography' },
  { table: 'services', column: 'name' },
  { table: 'services', column: 'description' },
  { table: 'users', column: 'full_name' },
  { table: 'users', column: 'email' },
  { table: 'users', column: 'phone' },
  { table: 'patient_profiles', column: 'some_column' }
];
(async () => {
  try {
    for (const { table, column } of columnsToScan) {
      try {
        const likeConditions = patterns.map((pat) => `${column} LIKE '%${pat}%'`).join(' OR ');
        const query = `SELECT COUNT(*) as count FROM \\`${table}\\` WHERE ${likeConditions}`;
        const result = await prisma.$queryRawUnsafe(query);
        console.log(`${table}.${column}:`, result[0]?.count ?? result[0]?.COUNT ?? result[0]);
      } catch (error) {
        console.error(`Error scanning ${table}.${column}:`, error.message);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
