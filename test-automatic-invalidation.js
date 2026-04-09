const fs = require('fs');
const path = require('path');
const { getLocalLicense, checkLicenseStatus, saveLocalLicense } = require('./app/lib/license.js');

const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');

async function testInvalidation() {
    console.log('--- Testing Automatic License Invalidation ---');

    // 1. Initial State
    const initial = await getLocalLicense();
    console.log('Initial Status:', initial.status);
    
    if (initial.status !== 'active') {
        console.log('Please activate a license first before running this test.');
        return;
    }

    // 2. Simulate Manual Tampering (Edit the school name while keeping signature)
    console.log('\n[Simulating Tampering] Changing instansi name manually...');
    const tampered = { ...initial, instansi: 'TAMPERED SCHOOL NAME' };
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(tampered, null, 2));

    // 3. Run Lazy Check (Simulating what happens in GET /api/license)
    console.log('\n[Lazy Check] Verifying integrity...');
    const integrity = await checkLicenseStatus();
    console.log('Integrity Result:', integrity);

    if (!integrity.valid) {
        console.log('Success: Integrity check detected tampering!');
        
        // Save the invalid status
        await saveLocalLicense({
            ...tampered,
            status: integrity.status,
            last_check: new Date().toISOString()
        });
        
        const final = await getLocalLicense();
        console.log('Final Status in File:', final.status);
        
        if (final.status === 'invalid_hwid' || final.status === 'expired') {
            console.log('\nVERIFICATION SUCCESS: Automatic invalidation works.');
        }
    } else {
        console.log('FAILED: Integrity check did not detect tampering.');
    }
}

testInvalidation();
