// background.js (MV3 service worker)

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'comparePrices' && msg.query) {
      (async () => {
        const query = msg.query;
        const currentHost = msg.currentHost || '';
  
        // Build search pages for other sites (exclude current host)
        const targets = [];
        
        // Only add Kroger if current host is not Kroger
        if (!currentHost.includes('kroger.com')) {
          targets.push({
            site: 'kroger',
            url: `https://www.kroger.com/search?query=${encodeURIComponent(query)}`,
            // PDP and search list fallbacks
            selectors: [
              '.kds-Price-promotional',
              '.kds-Price',
              '[data-qa="ProductPrices"] .kds-Price',
              '[data-qa="search-results"] .kds-Price',
            ],
            linkSelectors: [
              'a[data-qa="product-name"]',
              '[data-qa="product-card"] a',
              'a.kds-Link',
            ],
            titleSelectors: [
              'a[data-qa="product-name"]',
              '[data-qa="product-card"] a',
              '.kds-Text--l a',
            ],
          });
        }
        
        // Only add Walmart if current host is not Walmart
        if (!currentHost.includes('walmart.com')) {
          targets.push({
            site: 'walmart',
            url: `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
            // PDP and search list fallbacks
            selectors: [
              'span[itemprop="price"]',
              '.price-characteristic',
              '.price-group',
              '[data-automation-id="product-price"] span',
              '[data-automation-id="price"]',
              '.mr1.mr2-xl.lh-copy',
            ],
            linkSelectors: [
              'a[data-automation-id="product-title"]',
              'a[href*="/ip/"]',
              'a[href*="/ip"]',
            ],
            titleSelectors: [
              'a[data-automation-id="product-title"]',
              'a[href*="/ip/"]',
              'a[href*="/ip"]',
            ],
          });
        }
        
        // Only add Target if current host is not Target
        if (!currentHost.includes('target.com')) {
          targets.push({
            site: 'target',
            url: `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
            // PDP and search list fallbacks
            selectors: [
              '[data-test="product-price"]',
              '[data-test="current-price"]',
              '.h-display-xs',
              '[data-test="listing-price"]',
            ],
            linkSelectors: [
              'a[data-test="product-title"]',
              'a[href*="/p/"]',
            ],
            titleSelectors: [
              'a[data-test="product-title"]',
              'a[href*="/p/"]',
            ],
          });
        }
  
        const resultsArray = await Promise.all(
          targets.map(async (t) => {
            try {
              const price = await openAndScrape(t.url, t.selectors, t.linkSelectors, t.titleSelectors, query);
              return [t.site, price];
            } catch (e) {
              return [t.site, 'Error'];
            }
          })
        );

        const results = Object.fromEntries(resultsArray);
        sendResponse({ results });
  
      })();
  
      return true; // keep channel open for async sendResponse
    }
  });
  
  // Open a background tab, wait for load, inject scraper repeatedly until found or timeout, then close tab
  async function openAndScrape(url, selectors, linkSelectors, titleSelectors, originalQuery) {
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await waitForComplete(tab.id);
      const deadline = Date.now() + 10000; // up to ~10s for dynamic content
      let found = null;
      while (Date.now() < deadline) {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: scrapeFirstPrice,
          args: [selectors],
          world: 'MAIN',
        });
        if (result) { found = result; break; }
        await new Promise((r) => setTimeout(r, 350));
      }
      if (found) return found;

      // Try to collect candidates from search results and choose best match by query
      if (Array.isArray(titleSelectors) && titleSelectors.length) {
        const [{ result: candidates }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: scrapeCandidatesFromSearch,
          args: [titleSelectors, selectors],
          world: 'MAIN',
        });
        if (Array.isArray(candidates) && candidates.length) {
          const best = pickBestCandidate(candidates, originalQuery);
          if (best) {
            if (best.price) return best.price;
            if (best.href) {
              await chrome.tabs.update(tab.id, { url: best.href });
              await waitForComplete(tab.id);
              const deadline2 = Date.now() + 8000;
              while (Date.now() < deadline2) {
                const [{ result }] = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: scrapeFirstPrice,
                  args: [selectors],
                  world: 'MAIN',
                });
                if (result) return result;
                await new Promise((r) => setTimeout(r, 350));
              }
            }
          }
        }
      }

      // Try navigating to the first product link and scrape again
      if (Array.isArray(linkSelectors) && linkSelectors.length) {
        const [{ result: href }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: findFirstProductLink,
          args: [linkSelectors],
          world: 'MAIN',
        });
        if (href) {
          await chrome.tabs.update(tab.id, { url: href });
          await waitForComplete(tab.id);
          const deadline2 = Date.now() + 8000;
          while (Date.now() < deadline2) {
            const [{ result }] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: scrapeFirstPrice,
              args: [selectors],
              world: 'MAIN',
            });
            if (result) return result;
            await new Promise((r) => setTimeout(r, 350));
          }
        }
      }
      return 'Price not found';
    } finally {
      // best-effort cleanup
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
  
  function waitForComplete(tabId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
  
      function onUpdated(updatedTabId, info) {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      }
  
      chrome.tabs.onUpdated.addListener(onUpdated);
  
      const timer = setInterval(async () => {
        if (Date.now() - start > timeoutMs) {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          clearInterval(timer);
          reject(new Error('Timeout waiting for page load'));
        } else {
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (tab && tab.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            clearInterval(timer);
            resolve();
          }
        }
      }, 300);
    });
  }
  
  // Runs in the page to extract a price from the first matching element (synchronous)
  function scrapeFirstPrice(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = (el.getAttribute('content') || el.textContent || '').trim();
      if (!raw) continue;
      const condensed = raw.replace(/\s+/g, '');
      const m = condensed.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\d+(?:\.\d{1,2})?/);
      if (m && m[0]) return m[0].startsWith('$') ? m[0] : `$${m[0]}`;
      if (/\d/.test(condensed)) return condensed.startsWith('$') ? condensed : `$${condensed}`;
    }
    return null;
  }

  // Collect {title, price, href} candidates from search results
  function scrapeCandidatesFromSearch(titleSelectors, priceSelectors) {
    const titles = [];
    for (const sel of titleSelectors) {
      document.querySelectorAll(sel).forEach(a => {
        const href = a.getAttribute('href');
        const title = (a.textContent || '').trim();
        if (!title) return;
        // Try to find a nearby price within ancestor chain
        let price = null;
        let node = a;
        for (let i = 0; i < 6 && node; i++) {
          for (const ps of priceSelectors) {
            const p = node.querySelector?.(ps);
            if (p) {
              const raw = (p.getAttribute('content') || p.textContent || '').trim();
              if (raw) {
                const condensed = raw.replace(/\s+/g, '');
                const m = condensed.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\d+(?:\.\d{1,2})?/);
                if (m && m[0]) price = m[0].startsWith('$') ? m[0] : `$${m[0]}`;
                else if (/\d/.test(condensed)) price = condensed.startsWith('$') ? condensed : `$${condensed}`;
              }
            }
            if (price) break;
          }
          if (price) break;
          node = node.parentElement;
        }
        try {
          titles.push({
            title,
            href: href ? new URL(href, location.href).toString() : null,
            price: price || null,
          });
        } catch {
          titles.push({ title, href, price: price || null });
        }
      });
    }
    return titles;
  }

  // Pick best candidate by weighted similarity (Jaccard + numeric/unit + brand boosts)
  function pickBestCandidate(candidates, query) {
    const qtokens = tokenize(query);
    const qnums = extractNumericTokens(query);
    const qbrand = guessBrandToken(qtokens);
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const ctokens = tokenize(c.title);
      let score = jaccard(qtokens, ctokens);
      // boost numeric/unit matches (sizes, counts)
      const cnums = extractNumericTokens(c.title);
      const numMatches = qnums.filter((n) => cnums.includes(n)).length;
      score += Math.min(0.4, numMatches * 0.12);
      // boost brand token if present
      if (qbrand && ctokens.includes(qbrand)) score += 0.15;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    // Require minimal similarity
    if (best && bestScore >= 0.22) return best;
    return null;
  }

  // Extract numeric/unit tokens like 12oz, 1.5l, 2ct, 24-pack, 10 x 12oz
  function extractNumericTokens(s) {
    const text = (s || '').toLowerCase();
    const tokens = [];
    const unitRegex = /(\d+[\d\.,]*\s?(?:oz|ounce|fl\s?oz|lb|lbs|pound|ct|count|pk|pack|g|kg|l|ml|quart|qt|pt|liter|litre|dozen|dz))\b/g;
    let m;
    while ((m = unitRegex.exec(text)) !== null) tokens.push(m[1].replace(/\s+/g, ''));
    // raw numbers (like 12, 2, 24) limited to 1-3 digits to avoid years
    const nums = text.match(/\b\d{1,3}\b/g) || [];
    for (const n of nums) if (!tokens.includes(n)) tokens.push(n);
    return tokens;
  }

  // Heuristic guess of brand as the first non-generic token
  function guessBrandToken(tokens) {
    const stop = new Set(['the','and','with','for','of','in','to','a','an','by','on','at','from','new']);
    for (const t of tokens) {
      if (stop.has(t)) continue;
      if (/^\d/.test(t)) continue;
      if (t.length < 3) continue;
      return t;
    }
    return null;
  }

  function tokenize(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function jaccard(a, b) {
    const A = new Set(a);
    const B = new Set(b);
    const inter = new Set([...A].filter(x => B.has(x)));
    const uni = new Set([...A, ...B]);
    return uni.size ? inter.size / uni.size : 0;
  }

  // Returns first product detail link href from search results
  function findFirstProductLink(linkSelectors) {
    for (const sel of linkSelectors) {
      const a = document.querySelector(sel);
      const href = a?.getAttribute('href');
      if (href) {
        // Handle relative URLs
        try { return new URL(href, location.href).toString(); } catch { return href; }
      }
    }
    return null;
  }