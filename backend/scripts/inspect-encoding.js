require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rooms = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE rooms`);
    console.log('SHOW CREATE TABLE rooms:');
    console.log(rooms[0]['Create Table']);

    const cols = await prisma.$queryRawUnsafe(`SHOW FULL COLUMNS FROM rooms`);
    console.log('SHOW FULL COLUMNS FROM rooms:');
    console.table(cols.map(c => ({ Field: c.Field, Collation: c.Collation, Type: c.Type })));

    const messages = await prisma.$queryRawUnsafe(`SELECT name, HEX(name) AS hex_name FROM rooms LIMIT 5`);
    console.log('first 5 rooms:');
    console.table(messages.map(m => ({ name: m.name, hex: m.hex_name })));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
