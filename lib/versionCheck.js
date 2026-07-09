// lib/versionCheck.js

/**
 * Compares semantic versions and determines if logout is needed
 * @param {string} currentVersion - Current app version from env
 * @param {string} lastSeenVersion - Last version user saw from localStorage
 * @returns {boolean} - True if major version changed
 */
export function shouldForceLogout(currentVersion, lastSeenVersion) {
    if (!lastSeenVersion) return false; // First time user, don't logout
    
    const current = parseVersion(currentVersion);
    const lastSeen = parseVersion(lastSeenVersion);
    
    // Only logout on MAJOR version changes (e.g., 2.x.x -> 3.x.x)
    return current.major > lastSeen.major;
  }
  
  /**
   * Parses version string into major, minor, patch
   * @param {string} version - Version string (e.g., "2.3.0")
   * @returns {object} - Object with major, minor, patch numbers
   */
  function parseVersion(version) {
    const [major = 0, minor = 0, patch = 0] = version
      .split('.')
      .map(num => parseInt(num, 10));
    
    return { major, minor, patch };
  }
  
  /**
   * Gets the current app version from environment variable
   * @returns {string} - Current app version
   */
  export function getCurrentVersion() {
    return process.env.NEXT_PUBLIC_APP_VERSION || '2.3.0';
  }
  
  /**
   * Gets the last seen version from localStorage
   * @returns {string|null} - Last seen version or null
   */
  export function getLastSeenVersion() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('appVersion');
  }
  
  /**
   * Saves the current version to localStorage
   * @param {string} version - Version to save
   */
  export function saveVersion(version) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('appVersion', version);
  }
  
  /**
   * Clears all user data (logout cleanup)
   */
  export function clearUserData() {
    if (typeof window === 'undefined') return;
    
    const theme = localStorage.getItem('theme');
    localStorage.clear();
    if (theme) {
      localStorage.setItem('theme', theme);
    }
    
    sessionStorage.clear();
  }