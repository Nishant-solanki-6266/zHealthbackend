const http = require('http')

const emailA = `tsc_alpha_${Date.now().toString().slice(-4)}@zealthos.com`
const emailB = `tsc_beta_${Date.now().toString().slice(-4)}@zealthos.com`
const password = 'Password123!'

function makeRequest(method, path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : ''
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const req = http.request({
      hostname: 'localhost', port: 5001, path, method, headers
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { resolve({ statusCode: res.statusCode, data: body }) }
      })
    })
    req.on('error', err => reject(err))
    if (data) req.write(data)
    req.end()
  })
}

async function testTemplatesServicesCancellationTenantIsolation() {
  try {
    console.log('--- Step 1: Registering Clinic Alpha ---')
    const regA = await makeRequest('POST', '/api/auth/register', {
      organization: 'Alpha Therapy Hub', fullName: 'Dr. Alpha Admin', email: emailA, password
    })
    const tokenA = regA.data?.data?.accessToken

    console.log('\n--- Step 2: Registering Clinic Beta ---')
    const regB = await makeRequest('POST', '/api/auth/register', {
      organization: 'Beta Therapy Hub', fullName: 'Dr. Beta Admin', email: emailB, password
    })
    const tokenB = regB.data?.data?.accessToken

    console.log('\n--- Step 3: Creating Settings Templates ---')
    await makeRequest('POST', '/api/clinic-admin/settings/templates', { type: 'form', name: 'Alpha Custom Intake Form' }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/settings/templates', { type: 'form', name: 'Beta Custom Intake Form' }, tokenB)

    console.log('\n--- Step 4: Creating Services ---')
    await makeRequest('POST', '/api/clinic-admin/settings/services', { name: 'Alpha Specialized Rehab Service', price: 190 }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/settings/services', { name: 'Beta Specialized Rehab Service', price: 210 }, tokenB)

    console.log('\n--- Step 5: Creating Cancellation Reasons ---')
    await makeRequest('POST', '/api/clinic-admin/settings/cancellation-reasons', { reason: 'Alpha Specific Emergency Cancellation' }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/settings/cancellation-reasons', { reason: 'Beta Specific Emergency Cancellation' }, tokenB)

    console.log('\n--- Step 6: Verifying Clinic Alpha Isolation ---')
    const templatesA = (await makeRequest('GET', '/api/clinic-admin/settings/templates', null, tokenA)).data?.data || {}
    const servicesA = (await makeRequest('GET', '/api/clinic-admin/settings/services', null, tokenA)).data?.data || []
    const cancellationA = (await makeRequest('GET', '/api/clinic-admin/settings/cancellation-reasons', null, tokenA)).data?.data || []

    const formNamesA = (templatesA.forms || []).map(f => f.name)
    const serviceNamesA = servicesA.map(s => s.name)
    const cancellationReasonsA = cancellationA.map(c => c.reason)

    console.log('Clinic Alpha Forms:', formNamesA)
    console.log('Clinic Alpha Services:', serviceNamesA)
    console.log('Clinic Alpha Cancellation Reasons:', cancellationReasonsA)

    console.log('\n--- Step 7: Verifying Clinic Beta Isolation ---')
    const templatesB = (await makeRequest('GET', '/api/clinic-admin/settings/templates', null, tokenB)).data?.data || {}
    const servicesB = (await makeRequest('GET', '/api/clinic-admin/settings/services', null, tokenB)).data?.data || []
    const cancellationB = (await makeRequest('GET', '/api/clinic-admin/settings/cancellation-reasons', null, tokenB)).data?.data || []

    const formNamesB = (templatesB.forms || []).map(f => f.name)
    const serviceNamesB = servicesB.map(s => s.name)
    const cancellationReasonsB = cancellationB.map(c => c.reason)

    console.log('Clinic Beta Forms:', formNamesB)
    console.log('Clinic Beta Services:', serviceNamesB)
    console.log('Clinic Beta Cancellation Reasons:', cancellationReasonsB)

    console.log('\n--- AUDIT RESULTS FOR TEMPLATES, SERVICES & CANCELLATION REASONS ---')
    const alphaTemplatesIsolated = formNamesA.includes('Alpha Custom Intake Form') && !formNamesA.includes('Beta Custom Intake Form')
    const betaTemplatesIsolated = formNamesB.includes('Beta Custom Intake Form') && !formNamesB.includes('Alpha Custom Intake Form')

    const alphaServicesIsolated = serviceNamesA.includes('Alpha Specialized Rehab Service') && !serviceNamesA.includes('Beta Specialized Rehab Service')
    const betaServicesIsolated = serviceNamesB.includes('Beta Specialized Rehab Service') && !serviceNamesB.includes('Alpha Specialized Rehab Service')

    const alphaCancellationIsolated = cancellationReasonsA.includes('Alpha Specific Emergency Cancellation') && !cancellationReasonsA.includes('Beta Specific Emergency Cancellation')
    const betaCancellationIsolated = cancellationReasonsB.includes('Beta Specific Emergency Cancellation') && !cancellationReasonsB.includes('Alpha Specific Emergency Cancellation')

    console.log('Templates Isolated:', alphaTemplatesIsolated && betaTemplatesIsolated)
    console.log('Services Isolated:', alphaServicesIsolated && betaServicesIsolated)
    console.log('Cancellation Reasons Isolated:', alphaCancellationIsolated && betaCancellationIsolated)

    if (alphaTemplatesIsolated && betaTemplatesIsolated && alphaServicesIsolated && betaServicesIsolated && alphaCancellationIsolated && betaCancellationIsolated) {
      console.log('\n🎉 100% TEMPLATES, SERVICES & CANCELLATION REASONS MULTI-TENANT ISOLATION VERIFIED SUCCESS!')
    } else {
      console.log('\n❌ MULTI-TENANT ISOLATION FAILED!')
    }

  } catch (err) {
    console.error('Test error:', err)
  }
}

testTemplatesServicesCancellationTenantIsolation()
