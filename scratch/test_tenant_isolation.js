const http = require('http')

const emailA = `clinic_A_${Date.now().toString().slice(-4)}@zealth.com`
const emailB = `clinic_B_${Date.now().toString().slice(-4)}@zealth.com`
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

async function runTenantIsolationTest() {
  try {
    console.log('--- Step 1: Registering Clinic A ---')
    const regA = await makeRequest('POST', '/api/auth/register', {
      organization: 'Clinic Alpha', fullName: 'Dr. Alpha', email: emailA, password
    })
    const tokenA = regA.data?.data?.accessToken
    console.log('Clinic A registered:', regA.statusCode, regA.data?.data?.clinic?.id)

    console.log('\n--- Step 2: Registering Clinic B ---')
    const regB = await makeRequest('POST', '/api/auth/register', {
      organization: 'Clinic Beta', fullName: 'Dr. Beta', email: emailB, password
    })
    const tokenB = regB.data?.data?.accessToken
    console.log('Clinic B registered:', regB.statusCode, regB.data?.data?.clinic?.id)

    console.log('\n--- Step 3: Clinic A creates a Patient ---')
    const createPatientA = await makeRequest('POST', '/api/clinic-admin/patients', {
      fullName: 'Patient Alpha Only', email: 'alpha.patient@test.com', phone: '+61 400 111 222'
    }, tokenA)
    console.log('Clinic A Patient Creation:', createPatientA.statusCode, createPatientA.data?.data?.id)

    console.log('\n--- Step 4: Clinic B creates a Patient ---')
    const createPatientB = await makeRequest('POST', '/api/clinic-admin/patients', {
      fullName: 'Patient Beta Only', email: 'beta.patient@test.com', phone: '+61 400 333 444'
    }, tokenB)
    console.log('Clinic B Patient Creation:', createPatientB.statusCode, createPatientB.data?.data?.id)

    console.log('\n--- Step 5: Fetching Patients as Clinic A ---')
    const getA = await makeRequest('GET', '/api/clinic-admin/patients', null, tokenA)
    const listA = getA.data?.data || []
    const namesA = listA.map(p => p.fullName || p.name)
    console.log('Clinic A sees patients:', namesA)

    console.log('\n--- Step 6: Fetching Patients as Clinic B ---')
    const getB = await makeRequest('GET', '/api/clinic-admin/patients', null, tokenB)
    const listB = getB.data?.data || []
    const namesB = listB.map(p => p.fullName || p.name)
    console.log('Clinic B sees patients:', namesB)

    const alphaInA = namesA.includes('Patient Alpha Only')
    const betaInA = namesA.includes('Patient Beta Only')
    const betaInB = namesB.includes('Patient Beta Only')
    const alphaInB = namesB.includes('Patient Alpha Only')

    console.log('\n--- TENANT ISOLATION AUDIT VERIFICATION ---')
    console.log('Clinic A sees Patient Alpha:', alphaInA)
    console.log('Clinic A sees Patient Beta (MUST BE FALSE):', betaInA)
    console.log('Clinic B sees Patient Beta:', betaInB)
    console.log('Clinic B sees Patient Alpha (MUST BE FALSE):', alphaInB)

    if (alphaInA && !betaInA && betaInB && !alphaInB) {
      console.log('\n🎉 100% TENANT ISOLATION SUCCESS: Clinic Admins ONLY see their own clients/patients!')
    } else {
      console.log('\n❌ TENANT ISOLATION FAILED!')
    }
  } catch (err) {
    console.error('Test error:', err)
  }
}

runTenantIsolationTest()
