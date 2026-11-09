'use strict';
// Path helpers. Paths are relative to the player's folder and use "/".
const Paths = (() => {
  const baseName = p => p.slice(p.lastIndexOf('/') + 1);
  const dirName = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

  // Name of the folder this page is in, e.g. "HTMLProListPlayer".
  const pagePath = decodeURIComponent(location.pathname);
  const pageDirName = baseName(pagePath.slice(0, pagePath.lastIndexOf('/')));

  // A relative path as a URL a <video> can load. Each segment is encoded so names with spaces, # or ? work.
  const toUrl = p => p.split('/').map(encodeURIComponent).join('/');

  return { baseName, dirName, pageDirName, toUrl };
})();
