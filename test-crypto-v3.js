import { getRequestCode, decryptHWID, getHWID } from './app/lib/crypto.js';

console.log('--- HWID & Request Code Test ---');

const hwid = getHWID();
console.log('Detected HWID:', hwid);

const requestCode = getRequestCode();
console.log('Generated Request Code (AES):', requestCode);

if (requestCode && requestCode.includes('.')) {
    console.log('Format Check: SUCCESS (Contains dots)');
    
    const decrypted = decryptHWID(requestCode);
    console.log('Decrypted HWID:', decrypted);
    
    if (decrypted === hwid) {
        console.log('Verification: SUCCESS (Matches original HWID)');
    } else {
        console.log('Verification: FAILED (Mismatch)');
    }
} else {
    console.log('Format Check: FAILED (Missing dots)');
}
