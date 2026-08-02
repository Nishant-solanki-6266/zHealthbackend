const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const admins = await p.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true, name: true, role: true, status: true }
  })
  console.log('SUPER_ADMIN users found:', admins.length)
  console.log(JSON.stringify(admins, null, 2))

  const allUsers = await p.user.findMany({
    select: { email: true, role: true, status: true },
    take: 10
  })
  console.log('\nAll users (first 10):')
  console.log(JSON.stringify(allUsers, null, 2))
}

main().catch(e => console.error(e.message)).finally(() => p.$disconnect())
