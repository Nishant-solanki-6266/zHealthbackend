const prisma = require('../../config/db')

// Branches Management
const getBranches = async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany()
    res.json({ success: true, data: branches })
  } catch (err) {
    next(err)
  }
}

const createBranch = async (req, res, next) => {
  try {
    const branch = await prisma.branch.create({ data: req.body })
    res.json({ success: true, data: branch })
  } catch (err) {
    next(err)
  }
}

const updateBranch = async (req, res, next) => {
  try {
    const { id } = req.params
    const branch = await prisma.branch.update({ where: { id }, data: req.body })
    res.json({ success: true, data: branch })
  } catch (err) {
    next(err)
  }
}

const deleteBranch = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.branch.delete({ where: { id } })
    res.json({ success: true, message: 'Branch deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Practitioners Management
const getPractitioners = async (req, res, next) => {
  try {
    const practitioners = await prisma.practitioner.findMany()
    res.json({ success: true, data: practitioners })
  } catch (err) {
    next(err)
  }
}

const createPractitioner = async (req, res, next) => {
  try {
    const p = await prisma.practitioner.create({ data: req.body })
    res.json({ success: true, data: p })
  } catch (err) {
    next(err)
  }
}

const updatePractitioner = async (req, res, next) => {
  try {
    const { id } = req.params
    const p = await prisma.practitioner.update({ where: { id }, data: req.body })
    res.json({ success: true, data: p })
  } catch (err) {
    next(err)
  }
}

const deletePractitioner = async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.practitioner.delete({ where: { id } })
    res.json({ success: true, message: 'Practitioner deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// Invoices Management
const getInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: invoices })
  } catch (err) {
    next(err)
  }
}

const createInvoice = async (req, res, next) => {
  try {
    const inv = await prisma.invoice.create({ data: req.body })
    res.json({ success: true, data: inv })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getPractitioners,
  createPractitioner,
  updatePractitioner,
  deletePractitioner,
  getInvoices,
  createInvoice,
}
