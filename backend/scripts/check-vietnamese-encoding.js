require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const appMsgs = await prisma.$queryRawUnsafe(`SELECT message, HEX(message) AS hex_message FROM app_messages WHERE locale = 'vi' LIMIT 10`);
    console.log('*** app_messages vi ***');
    appMsgs.forEach((row) => {
      console.log('message:', row.message);
      console.log('hex:', row.hex_message);
      console.log('---');
    });

    const rooms = await prisma.$queryRawUnsafe(`SELECT name, HEX(name) AS hex_name FROM rooms LIMIT 5`);
    console.log('*** rooms ***');
    rooms.forEach((row) => {
      console.log('name:', row.name);
      console.log('hex:', row.hex_name);
      console.log('---');
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
