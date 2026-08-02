const prisma = require('../../config/db')

const getPatientProfile = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

const getPatientAppointments = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    })
    if (!patient) return res.json({ success: true, data: [] })

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: appointments })
  } catch (err) {
    next(err)
  }
}

const getPatientInvoices = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { userId: req.user.id },
    })
    if (!patient) return res.json({ success: true, data: [] })

    const invoices = await prisma.invoice.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: invoices })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getPatientProfile,
  getPatientAppointments,
  getPatientInvoices,
}
