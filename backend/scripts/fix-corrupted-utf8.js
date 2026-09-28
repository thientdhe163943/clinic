require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targets = [
  { table: 'rooms', column: 'name' },
  { table: 'rooms', column: 'description' },
  { table: 'app_messages', column: 'message' },
  { table: 'specialties', column: 'name' },
  { table: 'specialties', column: 'description' },
  { table: 'services', column: 'name' },
  { table: 'services', column: 'description' },
  { table: 'doctor_profiles', column: 'degree' },
  { table: 'doctor_profiles', column: 'biography' },
  { table: 'users', column: 'full_name' },
];

const patterns = [
  'Ã',
  'Â',
  'Ä',
  'áº',
  'Áº',
  'Ã¡',
  'Æ',
  'Ãƒ',
  'Ã…',
  'Ã†',
];

function buildWhere(column) {
  return patterns.map((pat) => `\`${column}\` LIKE '%${pat}%'`).join(' OR ');
}

(async () => {
  try {
    for (const target of targets) {
      const where = buildWhere(target.column);
      const updateSql = `UPDATE \`${target.table}\` SET \`${target.column}\` = CONVERT(BINARY(CONVERT(\`${target.column}\` USING latin1)) USING utf8mb4) WHERE ${where}`;
      const countSql = `SELECT COUNT(*) AS cnt FROM \`${target.table}\` WHERE ${where}`;
      const countRes = await prisma.$queryRawUnsafe(countSql);
      const count = countRes?.[0]?.cnt ?? countRes?.[0]?.COUNT ?? 0;
      if (count > 0) {
        console.log(`Fixing ${count} rows in ${target.table}.${target.column}`);
        await prisma.$executeRawUnsafe(updateSql);
      } else {
        console.log(`No corrupted rows found in ${target.table}.${target.column}`);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
