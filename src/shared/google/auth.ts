// ── Google OAuth helper using chrome.identity ──

import { GOOGLE_SCOPES } from '../constants';

let cachedToken: string | null = null;

/** Get an OAuth token, prompting user to sign in if needed */
export async function getAuthToken(interactive = true): Promise<string> {
  if (cachedToken) {
    // Validate the cached token is still good
    try {
      const resp = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${cachedToken}`);
      if (resp.ok) return cachedToken;
    } catch {
      // Token expired or invalid — fall through to get a new one
    }
    cachedToken = null;
  }

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Auth failed'));
        return;
      }
      if (!token) {
        reject(new Error('No token received'));
        return;
      }
      cachedToken = token;
      resolve(token);
    });
  });
}

/** Check if user is currently authenticated (non-interactive check) */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getAuthToken(false);
    return true;
  } catch {
    return false;
  }
}

/** Sign out and revoke the token */
export async function signOut(): Promise<void> {
  if (!cachedToken) return;

  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token: cachedToken! }, () => {
      // Also revoke with Google
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${cachedToken}`).catch(() => {});
      cachedToken = null;
      resolve();
    });
  });
}

/** Get user info (email, name) from Google */
export async function getUserInfo(token: string): Promise<{ email: string; name: string; picture: string } | null> {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}
