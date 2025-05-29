// Utility functions for managing cookies and localStorage

/**
 * Set a cookie
 */
export const setCookie = (name: string, value: string, days: number = 30): void => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "; expires=" + date.toUTCString();
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
};

/**
 * Get a cookie by name
 */
export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

/**
 * Delete a cookie
 */
export const deleteCookie = (name: string): void => {
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};

/**
 * Save a value to localStorage with a fallback to cookies
 */
export const saveToStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Fallback to cookies if localStorage is not available
    setCookie(key, value);
  }
};

/**
 * Get a value from localStorage with a fallback to cookies
 */
export const getFromStorage = (key: string): string | null => {
  try {
    const value = localStorage.getItem(key);
    if (value) return value;
  } catch (e) {
    // Ignore error and try cookies
  }
  
  return getCookie(key);
};

/**
 * Remove a value from localStorage and cookies
 */
export const removeFromStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Ignore error
  }
  
  deleteCookie(key);
};

/**
 * Generate a UUID for session tracking
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Get the current session ID or create a new one
 */
export const getSessionId = (): string => {
  const SESSION_KEY = 'vogo_session_id';
  let sessionId = getFromStorage(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = generateUUID();
    saveToStorage(SESSION_KEY, sessionId);
  }
  
  return sessionId;
};
