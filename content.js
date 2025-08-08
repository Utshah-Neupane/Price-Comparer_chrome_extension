document.addEventListener("DOMContentLoaded", () => {
    let scrapePrice = document.getElementById('scrapePrice');
    let price_value = document.getElementById('price_value');

    chrome.runtime.onMessage.addListener((request) => {
        let price = request.price;

        let h1 = document.createElement('h1');
        h1.innerText = `Price: ${price}`;
        price_value.appendChild(h1);

    });


    scrapePrice.addEventListener("click", async() => {
        let [tab] = await chrome.tabs.query({
            active : true,
            currentWindow : true,
        })

        chrome.scripting.executeScript({
            target : {tabId: tab.id},
            func : scrapePriceFromPage,
        });

        compareAcrossSites();

    });



    function scrapePriceFromPage() {
        const host = window.location.hostname;
    
        // Single, primary selector per site
        const selector =
            host.includes('kroger.com') ? '.kds-Price-promotional' :
            host.includes('walmart.com') ? 'span[itemprop="price"]' :
            host.includes('target.com') ? '[data-test="product-price"]' :
            null;
    
        if (!selector) {
            chrome.runtime.sendMessage({ price: 'Unsupported site' });
            return;
        }
    
        const el = document.querySelector(selector);
        if (!el) {
            chrome.runtime.sendMessage({ price: 'Price not found!' });
            return;
        }
    
        // Prefer content attr if present (common for Walmart), else text
        const raw = (el.getAttribute('content') || el.textContent || '').trim();
        if (!raw) {
            chrome.runtime.sendMessage({ price: 'Price not found!' });
            return;
        }
    
        const price = raw.replace(/\s+/g, '');
        chrome.runtime.sendMessage({ price });
    }




    async function compareAcrossSites() {
        // 1) get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            chrome.runtime.sendMessage({ price: 'No active tab' });
            return;
        }
    
        // 2) run extractor IN THE PAGE to get a decent query (selected text > product title > page title)
        const [{ result: query }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const sel = window.getSelection?.().toString().trim();
                if (sel) return sel;
    
                // common product title guesses
                const candidates = [
                    'h1[data-automation-id="product-title"]',  // Walmart
                    'h1[data-test="product-title"]',           // Target
                    'h1',                                      // generic
                    '[itemprop="name"]'
                ];
    
                for (const sel of candidates) {
                    const el = document.querySelector(sel);
                    const txt = el?.textContent?.trim();
                    if (txt && txt.length > 3) return txt;
                }
                return document.title?.trim() || '';
            },
            world: 'MAIN',
        }).catch(() => [{ result: '' }]);
    
        if (!query) {
            chrome.runtime.sendMessage({ price: 'No query text found' });
            return;
        }
    
        // 3) optional: show loading UI
        const container = document.getElementById('price_value');
        if (container) {
            const loading = document.createElement('div');
            loading.id = 'compare-loading';
            loading.textContent = 'Comparing prices...';
            container.appendChild(loading);
        }
    
        // 4) ask background to compare
        chrome.runtime.sendMessage(
            {
                action: 'comparePrices',
                query,
                currentHost: window.location.hostname,
            },
            (response) => {
                // remove loading if present
                const loading = document.getElementById('compare-loading');
                if (loading) loading.remove();
    
                const results = response?.results || {};
                const container = document.getElementById('price_value');
                if (container) {
                    const wrap = document.createElement('div');
                    wrap.innerHTML = `
                        <h1>Comparison</h1>
                        <div>Kroger: ${results.kroger || '-'}</div>
                        <div>Walmart: ${results.walmart || '-'}</div>
                        <div>Target: ${results.target || '-'}</div>
                    `;
                    container.appendChild(wrap);
                }
            }
        );
    }







});






