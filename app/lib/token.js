import crypto from 'crypto';

// A constant salt for generating tokens (could be moved to env later)
const TOKEN_SALT = process.env.TOKEN_SECRET_SALT || 'rUshL35s_3xAm_s4lT';
const TOKEN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates an auto-token exactly 6 digits long.
 * The token changes deterministically every 15 minutes based on the current epoch time.
 * We include the examId so different exams have different tokens at the same time.
 * @param {string|number} examId - The ID of the exam.
 * @returns {string} - A 6-digit numeric token as a string.
 */
export function generateAutoToken(examId) {
    // Current time chunk index (changes every 15 mins)
    const timeChunkIndex = Math.floor(Date.now() / TOKEN_INTERVAL_MS);
    
    // Create a string that uniquely represents this exact exam during this exact 15-minute window
    const baseString = `${examId}-${timeChunkIndex}-${TOKEN_SALT}`;
    
    // Hash it using SHA-256
    const hash = crypto.createHash('sha256').update(baseString).digest('hex');
    
    // Extract out 6 numeric digits from the hash.
    // We convert a slice of the hash to an integer, then pad/mod it to 6 digits.
    // For safety, just parse the first 8 bytes of the hash integer
    const hashInt = parseInt(hash.substring(0, 8), 16);
    
    // Modulo 1,000,000 to get a number between 0 and 999999
    const tokenNum = hashInt % 1000000;
    
    // Pad to ensure it's exactly 6 digits (e.g., "001234")
    return tokenNum.toString().padStart(6, '0');
}
