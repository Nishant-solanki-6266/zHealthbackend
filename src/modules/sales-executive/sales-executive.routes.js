const express = require('express')
const router = express.Router()
const controller = require('./sales-executive.controller')
const authenticate = require('../../middlewares/auth.middleware')
const authorize = require('../../middlewares/role.middleware')

router.use(authenticate, authorize('SUPER_ADMIN', 'SALES_EXECUTIVE'))

router.get('/leads', controller.getLeads)
router.post('/leads', controller.createLead)
router.patch('/leads/:id/status', controller.updateLeadStatus)

module.exports = router
