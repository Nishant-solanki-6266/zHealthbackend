const prisma = require('../../config/db')

const getLeads = async (req, res, next) => {
  try {
    const leads = await prisma.salesLead.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: leads })
  } catch (err) {
    next(err)
  }
}

const createLead = async (req, res, next) => {
  try {
    const lead = await prisma.salesLead.create({ data: req.body })
    res.json({ success: true, data: lead })
  } catch (err) {
    next(err)
  }
}

const updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const lead = await prisma.salesLead.update({ where: { id }, data: { status } })
    res.json({ success: true, data: lead })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getLeads,
  createLead,
  updateLeadStatus,
}
