const express = require('express')
const router = express.Router()
const controller = require('./clinic-admin.controller')
const authenticate = require('../../middlewares/auth.middleware')
const authorize = require('../../middlewares/role.middleware')

router.use(authenticate, authorize('SUPER_ADMIN', 'CLINIC_ADMIN'))

router.get('/branches', controller.getBranches)
router.post('/branches', controller.createBranch)
router.put('/branches/:id', controller.updateBranch)
router.delete('/branches/:id', controller.deleteBranch)

router.get('/practitioners', controller.getPractitioners)
router.post('/practitioners', controller.createPractitioner)
router.put('/practitioners/:id', controller.updatePractitioner)
router.delete('/practitioners/:id', controller.deletePractitioner)

router.get('/invoices', controller.getInvoices)
router.post('/invoices', controller.createInvoice)

module.exports = router
