const http = require('http')

const emailA = `tags_alpha_${Date.now().toString().slice(-4)}@zealthos.com`
const emailB = `tags_beta_${Date.now().toString().slice(-4)}@zealthos.com`
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

async function testClientTagsTenantIsolation() {
  try {
    console.log('--- Step 1: Registering Clinic Alpha ---')
    const regA = await makeRequest('POST', '/api/auth/register', {
      organization: 'Alpha Client Services', fullName: 'Dr. Alpha Tags', email: emailA, password
    })
    const tokenA = regA.data?.data?.accessToken

    console.log('\n--- Step 2: Registering Clinic Beta ---')
    const regB = await makeRequest('POST', '/api/auth/register', {
      organization: 'Beta Client Services', fullName: 'Dr. Beta Tags', email: emailB, password
    })
    const tokenB = regB.data?.data?.accessToken

    console.log('\n--- Step 3: Clinic Alpha creates Client Tag ---')
    const tagA = await makeRequest('POST', '/api/clinic-admin/settings/tags', {
      name: 'Alpha VIP Premium Client Tag', color: '#FF0055', iconName: 'CrownOutlined'
    }, tokenA)
    console.log('Clinic Alpha Tag Creation Status:', tagA.statusCode, tagA.data?.data?.id)

    console.log('\n--- Step 4: Clinic Beta creates Client Tag ---')
    const tagB = await makeRequest('POST', '/api/clinic-admin/settings/tags', {
      name: 'Beta Corporate Elite Client Tag', color: '#00FF55', iconName: 'StarOutlined'
    }, tokenB)
    console.log('Clinic Beta Tag Creation Status:', tagB.statusCode, tagB.data?.data?.id)

    console.log('\n--- Step 5: Clinic Alpha fetches Client Tags ---')
    const listA = await makeRequest('GET', '/api/clinic-admin/settings/tags', null, tokenA)
    const tagNamesA = (listA.data?.data || []).map(t => t.name)
    console.log('Clinic Alpha Tags:', tagNamesA)

    console.log('\n--- Step 6: Clinic Beta fetches Client Tags ---')
    const listB = await makeRequest('GET', '/api/clinic-admin/settings/tags', null, tokenB)
    const tagNamesB = (listB.data?.data || []).map(t => t.name)
    console.log('Clinic Beta Tags:', tagNamesB)

    console.log('\n--- CLIENT TAGS MULTI-TENANT ISOLATION AUDIT ---')
    const alphaHasAlpha = tagNamesA.includes('Alpha VIP Premium Client Tag')
    const alphaHasBeta = tagNamesA.includes('Beta Corporate Elite Client Tag')
    const betaHasBeta = tagNamesB.includes('Beta Corporate Elite Client Tag')
    const betaHasAlpha = tagNamesB.includes('Alpha VIP Premium Client Tag')

    console.log('Clinic Alpha sees Alpha Tag:', alphaHasAlpha)
    console.log('Clinic Alpha sees Beta Tag (MUST BE FALSE):', alphaHasBeta)
    console.log('Clinic Beta sees Beta Tag:', betaHasBeta)
    console.log('Clinic Beta sees Alpha Tag (MUST BE FALSE):', betaHasAlpha)

    if (alphaHasAlpha && !alphaHasBeta && betaHasBeta && !betaHasAlpha) {
      console.log('\n🎉 100% CLIENT TAGS END-TO-END MULTI-TENANT ISOLATION VERIFIED SUCCESS!')
    } else {
      console.log('\n❌ CLIENT TAGS MULTI-TENANT ISOLATION FAILED!')
    }

  } catch (err) {
    console.error('Test error:', err)
  }
}

testClientTagsTenantIsolation()
