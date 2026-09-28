require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rooms = await prisma.room.findMany({ take: 10 });
    console.log('rooms', rooms.length);
    rooms.forEach((room) => {
      console.log('id:', room.id);
      console.log('name:', room.name);
      const bytes = Buffer.from(room.name, 'utf8');
      console.log('utf8 bytes:', bytes.toJSON().data);
      console.log('---');
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
