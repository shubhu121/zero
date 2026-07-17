// Meta / Open Graph tag generator with live Google + social-card previews.
// Fill the fields, preview how it looks, copy the tags. All local.

function $(id: string) { return document.getElementById(id)!; }

function attrEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function initMeta() {
  const title = $('mt-title') as HTMLInputElement;
  const desc = $('mt-desc') as HTMLTextAreaElement;
  const url = $('mt-url') as HTMLInputElement;
  const image = $('mt-image') as HTMLInputElement;

  const gTitle = $('mt-g-title');
  const gUrl = $('mt-g-url');
  const gDesc = $('mt-g-desc');
  const cImg = $('mt-card-img') as HTMLImageElement;
  const cTitle = $('mt-card-title');
  const cDesc = $('mt-card-desc');
  const cDomain = $('mt-card-domain');
  const out = $('mt-output') as HTMLTextAreaElement;
  const copyBtn = $('mt-copy');

  function run() {
    const t = title.value || 'Your page title';
    const d = desc.value || 'Your meta description shows up here, about 155 characters of summary.';
    const u = url.value || 'https://example.com/page';
    const img = image.value;

    // Google result preview
    gTitle.textContent = t.slice(0, 60);
    gUrl.textContent = u;
    gDesc.textContent = d.slice(0, 160);

    // Social card preview
    cTitle.textContent = t;
    cDesc.textContent = d.slice(0, 120);
    cDomain.textContent = domainOf(u).toUpperCase();
    if (img) { cImg.src = img; cImg.style.display = ''; } else { cImg.removeAttribute('src'); cImg.style.display = 'none'; }

    // Generated tags
    const lines = [
      `<title>${attrEsc(t)}</title>`,
      `<meta name="description" content="${attrEsc(d)}">`,
      `<link rel="canonical" href="${attrEsc(u)}">`,
      ``,
      `<meta property="og:type" content="website">`,
      `<meta property="og:url" content="${attrEsc(u)}">`,
      `<meta property="og:title" content="${attrEsc(t)}">`,
      `<meta property="og:description" content="${attrEsc(d)}">`,
      img ? `<meta property="og:image" content="${attrEsc(img)}">` : `<!-- add og:image for a large preview -->`,
      ``,
      `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${attrEsc(t)}">`,
      `<meta name="twitter:description" content="${attrEsc(d)}">`,
      img ? `<meta name="twitter:image" content="${attrEsc(img)}">` : null,
    ].filter((l) => l !== null);
    out.value = lines.join('\n');
  }

  [title, desc, url, image].forEach((el) => el.addEventListener('input', run));
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy tags'), 1200);
    } catch { out.select(); }
  });

  title.value = 'TabZero — browser tools that respect you';
  desc.value = 'Zero-server, privacy-first developer and design tools. Everything runs in your browser; nothing is uploaded.';
  url.value = 'https://tabzero.example';
  run();
}
