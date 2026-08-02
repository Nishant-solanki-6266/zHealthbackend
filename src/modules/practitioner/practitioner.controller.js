const prisma = require('../../config/db')

// Appointments
const getAppointments = async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: appointments })
  } catch (err) {
    next(err)
  }
}

const createAppointment = async (req, res, next) => {
  try {
    const appt = await prisma.appointment.create({ data: req.body })
    res.json({ success: true, data: appt })
  } catch (err) {
    next(err)
  }
}

const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params
    const appt = await prisma.appointment.update({ where: { id }, data: req.body })
    res.json({ success: true, data: appt })
  } catch (err) {
    next(err)
  }
}

const deleteAppointment = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.appointment.delete({ where: { id } })
    res.json({ success: true, message: 'Appointment deleted' })
  } catch (err) {
    next(err)
  }
}

// Waitlist
const getWaitlist = async (req, res, next) => {
  try {
    const waitlist = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: waitlist })
  } catch (err) {
    next(err)
  }
}

const addToWaitlist = async (req, res, next) => {
  try {
    const entry = await prisma.waitlist.create({ data: req.body })
    res.json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
}

const updateWaitlistStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const entry = await prisma.waitlist.update({ where: { id }, data: { status } })
    res.json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
}

const removeFromWaitlist = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.waitlist.delete({ where: { id } })
    res.json({ success: true, message: 'Waitlist item removed' })
  } catch (err) {
    next(err)
  }
}

// Patients
const getPatients = async (req, res, next) => {
  try {
    const patients = await prisma.patient.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: patients })
  } catch (err) {
    next(err)
  }
}

const createPatient = async (req, res, next) => {
  try {
    const patient = await prisma.patient.create({ data: req.body })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params
    const patient = await prisma.patient.update({ where: { id }, data: req.body })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getWaitlist,
  addToWaitlist,
  updateWaitlistStatus,
  removeFromWaitlist,
  getPatients,
  createPatient,
  updatePatient,
}
