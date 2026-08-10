const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugPoliteClinic() {
  try {
    // Find the polite clinic
    const clinic = await prisma.clinic.findFirst({
      where: { name: { contains: 'polite' } }
    })
    console.log('Clinic "polite":', JSON.stringify(clinic, null, 2))

    // Find matching user by clinic email
    if (clinic) {
      const userByEmail = await prisma.user.findFirst({
        where: { email: clinic.email }
      })
      console.log('\nUser matched by clinic email:', userByEmail ? {
        id: userByEmail.id,
        email: userByEmail.email,
        name: userByEmail.name,
        role: userByEmail.role,
        profileData: userByEmail.profileData
      } : 'NOT FOUND')

      // Find all clinic admins and check profileData for this clinicId
      const allClinicAdmins = await prisma.user.findMany({
        where: { role: 'CLINIC_ADMIN' },
        select: { id: true, email: true, name: true, profileData: true }
      })
      console.log('\nAll Clinic Admins:')
      allClinicAdmins.forEach(u => {
        const pData = u.profileData
        console.log(`  - ${u.email} | name: ${u.name} | clinicId in profileData: ${pData?.clinicId || 'NOT SET'}`)
      })
    }
  } catch (err) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}

debugPoliteClinic()
