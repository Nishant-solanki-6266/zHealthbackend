const http = require('http')

const emailA = `settings_alpha_${Date.now().toString().slice(-4)}@zealthos.com`
const emailB = `settings_beta_${Date.now().toString().slice(-4)}@zealthos.com`
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

async function testSettingsMenusTenantIsolation() {
  try {
    console.log('--- Step 1: Registering Clinic Alpha ---')
    const regA = await makeRequest('POST', '/api/auth/register', {
      organization: 'Alpha Clinic Health', fullName: 'Dr. Alpha Admin', email: emailA, password
    })
    const tokenA = regA.data?.data?.accessToken

    console.log('\n--- Step 2: Registering Clinic Beta ---')
    const regB = await makeRequest('POST', '/api/auth/register', {
      organization: 'Beta Clinic Health', fullName: 'Dr. Beta Admin', email: emailB, password
    })
    const tokenB = regB.data?.data?.accessToken

    console.log('\n--- Step 3: Creating Branches ---')
    await makeRequest('POST', '/api/clinic-admin/branches', { name: 'Alpha Sydney Branch' }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/branches', { name: 'Beta Melbourne Branch' }, tokenB)

    console.log('\n--- Step 4: Creating Practitioners ---')
    await makeRequest('POST', '/api/clinic-admin/practitioners', { name: 'Dr. Alpha Specialist', email: `alpha_spec_${Date.now()}@a.com` }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/practitioners', { name: 'Dr. Beta Specialist', email: `beta_spec_${Date.now()}@b.com` }, tokenB)

    console.log('\n--- Step 5: Creating Admins / Team Members ---')
    await makeRequest('POST', '/api/clinic-admin/admins', { name: 'Alpha Team Manager', email: `alpha_mgr_${Date.now()}@a.com`, role: 'Manager' }, tokenA)
    await makeRequest('POST', '/api/clinic-admin/admins', { name: 'Beta Team Manager', email: `beta_mgr_${Date.now()}@b.com`, role: 'Manager' }, tokenB)

    console.log('\n--- Step 6: Verifying Clinic Alpha Isolation ---')
    const branchesA = (await makeRequest('GET', '/api/clinic-admin/branches', null, tokenA)).data?.data || []
    const practitionersA = (await makeRequest('GET', '/api/clinic-admin/practitioners', null, tokenA)).data?.data || []
    const adminsA = (await makeRequest('GET', '/api/clinic-admin/admins', null, tokenA)).data?.data || []

    const branchNamesA = branchesA.map(b => b.name)
    const practitionerNamesA = practitionersA.map(p => p.name)
    const adminNamesA = adminsA.map(a => a.name)

    console.log('Clinic Alpha Branches:', branchNamesA)
    console.log('Clinic Alpha Practitioners:', practitionerNamesA)
    console.log('Clinic Alpha Admins:', adminNamesA)

    console.log('\n--- Step 7: Verifying Clinic Beta Isolation ---')
    const branchesB = (await makeRequest('GET', '/api/clinic-admin/branches', null, tokenB)).data?.data || []
    const practitionersB = (await makeRequest('GET', '/api/clinic-admin/practitioners', null, tokenB)).data?.data || []
    const adminsB = (await makeRequest('GET', '/api/clinic-admin/admins', null, tokenB)).data?.data || []

    const branchNamesB = branchesB.map(b => b.name)
    const practitionerNamesB = practitionersB.map(p => p.name)
    const adminNamesB = adminsB.map(a => a.name)

    console.log('Clinic Beta Branches:', branchNamesB)
    console.log('Clinic Beta Practitioners:', practitionerNamesB)
    console.log('Clinic Beta Admins:', adminNamesB)

    console.log('\n--- AUDIT RESULTS FOR SETTINGS MENUS ---')
    const alphaBranchesIsolated = branchNamesA.includes('Alpha Sydney Branch') && !branchNamesA.includes('Beta Melbourne Branch')
    const betaBranchesIsolated = branchNamesB.includes('Beta Melbourne Branch') && !branchNamesB.includes('Alpha Sydney Branch')

    const alphaPractitionersIsolated = practitionerNamesA.includes('Dr. Alpha Specialist') && !practitionerNamesA.includes('Dr. Beta Specialist')
    const betaPractitionersIsolated = practitionerNamesB.includes('Dr. Beta Specialist') && !practitionerNamesB.includes('Dr. Alpha Specialist')

    const alphaAdminsIsolated = adminNamesA.includes('Alpha Team Manager') && !adminNamesA.includes('Beta Team Manager')
    const betaAdminsIsolated = adminNamesB.includes('Beta Team Manager') && !adminNamesB.includes('Alpha Team Manager')

    console.log('Branches Isolated:', alphaBranchesIsolated && betaBranchesIsolated)
    console.log('Practitioners Isolated:', alphaPractitionersIsolated && betaPractitionersIsolated)
    console.log('Admins/Users Isolated:', alphaAdminsIsolated && betaAdminsIsolated)

    if (alphaBranchesIsolated && betaBranchesIsolated && alphaPractitionersIsolated && betaPractitionersIsolated && alphaAdminsIsolated && betaAdminsIsolated) {
      console.log('\n🎉 100% SETTINGS (BRANCHES, PRACTITIONERS, ADMINS) MULTI-TENANT ISOLATION VERIFIED SUCCESS!')
    } else {
      console.log('\n❌ SETTINGS TENANT ISOLATION FAILED!')
    }

  } catch (err) {
    console.error('Test error:', err)
  }
}

testSettingsMenusTenantIsolation()
