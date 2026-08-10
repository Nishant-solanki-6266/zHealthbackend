const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugUpdate() {
  try {
    const oldEmail = 'edit_before_2763@zealth.com'
    const newEmail = 'edit_AFTER_2763@zealth.com'

    console.log('Searching user with oldEmail:', oldEmail)
    const userOld = await prisma.user.findFirst({ where: { email: oldEmail } })
    console.log('User found by old email:', userOld)

    console.log('Searching user with newEmail:', newEmail)
    const userNew = await prisma.user.findFirst({ where: { email: newEmail } })
    console.log('User found by new email:', userNew)

    const allUsers = await prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' } })
    console.log('Recent Users:', allUsers.map(u => ({ id: u.id, email: u.email, name: u.name, profileData: u.profileData })))
  } catch (err) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}

debugUpdate()
