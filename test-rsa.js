const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.resolve(process.cwd(), 'keys/private.pem');
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvpd/2OkoYQyu0sA+7+F/
tHVKkF47Q6mKjhby3t7P8iAbumo6o7Zhe2t7QsRKPX9Ez5dQaYKbSrgkOmjlFdyL
jRCD/MLUFudF2GBK39tebTtK61BqCEsQiyPJIbYT/3DGzbfDOpnC8LE+KqU5HcWF
8eXrDrTi23XEVA2E6+0OaXEAJPSMJ7/7rC0uEfK3VF+gzOPUp4pu2ncJ72aC/HNr
bzgVOfCnQUvmv1Jn3BOMy4057G/0xYmaShRlWuQKXNxfOSLdCIuY6bIiX4Zv+Gds
S9QvABzB90NwAKbGggd+jJrD/1BcARavYTlqDsllaaSCyw9XvGpqjSjO3UcpTMny
qQIDAQAB
-----END PUBLIC KEY-----`;

async function test() {
    try {
        if (!fs.existsSync(PRIVATE_KEY_PATH)) {
            console.error('Private key not found!');
            return;
        }
        const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

        const text = "TEST-HWID-123";
        console.log('Original Text:', text);

        // Encrypt with hardcoded public key
        const buffer = Buffer.from(text, 'utf8');
        const encrypted = crypto.publicEncrypt(
            {
                key: PUBLIC_KEY_PEM,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            buffer
        );
        const encryptedBase64 = encrypted.toString('base64');
        console.log('Encrypted (Base64):', encryptedBase64);

        // Decrypt with private key
        const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
        try {
            const decrypted = crypto.privateDecrypt(
                {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: 'sha256',
                },
                encryptedBuffer
            );
            console.log('Decrypted (SHA-256):', decrypted.toString('utf8'));
        } catch (err) {
            console.error('Decryption SHA-256 failed:', err.message);
            
            // Try SHA-1
            try {
                const decrypted1 = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: 'sha1',
                    },
                    encryptedBuffer
                );
                console.log('Decrypted (SHA-1):', decrypted1.toString('utf8'));
            } catch (err1) {
                console.error('Decryption SHA-1 failed:', err1.message);
            }
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
