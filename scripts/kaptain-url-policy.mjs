/** Known Kaptain-controlled origins and public GitHub/CDN mirrors.
 * Keeps archive paths on our own Ma-Art hostname valid: they are *our* copies.
 * This is a preventive URL filter, not proof of ownership of arbitrary hosts.
 */
export function isKaptainUrl(input) {
  let url;
  try { url = new URL(String(input)); } catch { return false; }
  const host = url.hostname.toLowerCase();
  let path;
  try { path = decodeURIComponent(url.pathname).toLowerCase(); }
  catch { path = url.pathname.toLowerCase(); }
  if (host === 'kaptain.stream' || host.endsWith('.kaptain.stream') ||
      host === 'imkaptain.github.io') return true;
  if (host === 'api.nuvio.tv' && path.includes('kaptain')) return true;
  if (['github.com','raw.githubusercontent.com','api.github.com',
       'githubusercontent.com','gist.githubusercontent.com',
       'raw.githack.com','rawcdn.githack.com'].includes(host)) {
    if (/^\/(?:repos\/)?imkaptain(?:\/|$)/.test(path)) return true;
  }
  if (['cdn.jsdelivr.net','cdn.statically.io','gitcdn.xyz'].includes(host)) {
    if (/^\/(?:gh|npm|repo|raw)\/imkaptain(?:\/|@|$)/.test(path)) return true;
  }
  // A proxy image URL must not provide an escape hatch for the blocked origin.
  if (['images.weserv.nl','wsrv.nl'].includes(host)) {
    for (const key of ['url','src','image']) {
      const value = url.searchParams.get(key);
      if (value && (isKaptainUrl(value) || isKaptainUrl('https://' + value))) return true;
    }
  }
  return false;
}
