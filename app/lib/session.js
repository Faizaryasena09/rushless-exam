// IMPORTANT: Store this secret in environment variables in a real application.
// For demonstration, we're using a hardcoded secret.
// Generate a secure secret with: openssl rand -base64 32
export const sessionOptions = {
    password: 'a_super_secret_password_that_is_at_least_32_char_long',
    cookieName: 'rushless-exam-session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
    },
  };
