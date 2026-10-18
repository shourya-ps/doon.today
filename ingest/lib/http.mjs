export async function fetchText(url, {timeoutMs=20000}={}) {
  const controller = new AbortController();
  const timer=setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; doon.today/0.1; +https://doon.today/about)','accept-language':'en-IN,en;q=0.9'},redirect:'follow',signal:controller.signal});
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}
