/** Canonical HTTPS origin for auth email links (reset + sign-up). */
export const WEB_APP_URL = 'https://app.bloodlinebookapp.com';

export const PASSWORD_RESET_REDIRECT_URL = `${WEB_APP_URL}/reset-password`;

/** Where Supabase sends users after confirming a new account email. */
export const SIGNUP_EMAIL_REDIRECT_URL = WEB_APP_URL;
