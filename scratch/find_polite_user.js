const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcrypt = require('bcryptjs')

async function findAndFixPoliteUser() {
  try {
    // Find user with polite in email
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'polite' } },
          { email: { contains: 'joker' } },
          { email: { contains: 'jiker' } }
        ]
      },
      select: { id: true, email: true, name: true, role: true, profileData: true, passwordHash: true }
    })
    console.log('Found users:', users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, hasPassword: !!u.passwordHash })))

    // Also print ALL clinic admins for clarity
    const allCA = await prisma.user.findMany({
      where: { role: 'CLINIC_ADMIN' },
      select: { id: true, email: true, name: true }
    })
    console.log('All clinic admins:', allCA)
  } catch (err) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}

findAndFixPoliteUser()
