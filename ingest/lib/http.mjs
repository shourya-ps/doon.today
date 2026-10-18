function publicUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

export async function fetchText(url, {timeoutMs=20000}={}) {
  const controller = new AbortController();
  const timer=setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; doon.today/0.1; +https://doon.today/about)','accept-language':'en-IN,en;q=0.9'},redirect:'follow',signal:controller.signal});
    if(!r.ok) {
      const diagnostics = {
        status: r.status,
        requestedUrl: publicUrl(url),
        finalUrl: publicUrl(r.url),
        contentType: r.headers.get('content-type'),
        server: r.headers.get('server'),
        cacheStatus: r.headers.get('x-cache'),
        retryAfter: r.headers.get('retry-after')
      };
      const error = new Error(`${r.status} ${r.statusText} from ${diagnostics.finalUrl}`);
      error.diagnostics = diagnostics;
      throw error;
    }
    return await r.text();
  } finally { clearTimeout(timer); }
}
