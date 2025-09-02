document.addEventListener("DOMContentLoaded", () => {
    let scrapePrice = document.getElementById('scrapePrice');
    let price_value = document.getElementById('price_value');

    let currentPrice = '';
    
    chrome.runtime.onMessage.addListener((request) => {
        if (request.price) {
            currentPrice = request.price;
            // Only update the price display if we're not in the middle of a comparison
            if (!document.querySelector('.comparison-prices')) {
                price_value.innerHTML = `
                    <div class="current-price">
                        <span class="current-site">Current Price</span>
                        <span class="current-amount">${currentPrice}</span>
                    </div>
                `;
            }
        }
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
        
        // Get the current host from the URL
        const currentHost = new URL(tab.url).hostname;
    
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
                currentHost: currentHost,
            },
            (response) => {
                // remove loading if present
                const loading = document.getElementById('compare-loading');
                if (loading) loading.remove();
    
                const results = response?.results || {};
                const container = document.getElementById('price_value');
                if (container) {
                    container.innerHTML = ''; // Clear previous results
                    const wrap = document.createElement('div');
                    
                    // Add current site's price at the top
                    if (currentPrice) {
                        const currentSite = currentHost.includes('kroger.com') ? 'Kroger' : 
                                         currentHost.includes('walmart.com') ? 'Walmart' :
                                         currentHost.includes('target.com') ? 'Target' : 'Current Site';
                        
                        wrap.innerHTML = `
                            <h1>Price Comparison</h1>
                            <div class="current-price">
                                <span class="current-site">${currentSite}</span>
                                <span class="current-amount">${currentPrice}</span>
                            </div>
                            <div class="comparison-header">Other Retailers</div>
                        `;
                    } else {
                        wrap.innerHTML = '<h1>Price Comparison</h1>';
                    }
                    
                    // Add comparison prices
                    const comparisonDiv = document.createElement('div');
                    comparisonDiv.className = 'comparison-prices';
                    
                    if (!currentHost.includes('kroger.com') && results.kroger) {
                        const row = document.createElement('div');
                        row.className = 'price-row';
                        row.innerHTML = `
                            <span class="price-store">Kroger</span>
                            <span class="price-amount">${results.kroger}</span>
                        `;
                        comparisonDiv.appendChild(row);
                    }
                    
                    if (!currentHost.includes('walmart.com') && results.walmart) {
                        const row = document.createElement('div');
                        row.className = 'price-row';
                        row.innerHTML = `
                            <span class="price-store">Walmart</span>
                            <span class="price-amount">${results.walmart}</span>
                        `;
                        comparisonDiv.appendChild(row);
                    }
                    
                    if (!currentHost.includes('target.com') && results.target) {
                        const row = document.createElement('div');
                        row.className = 'price-row';
                        row.innerHTML = `
                            <span class="price-store">Target</span>
                            <span class="price-amount">${results.target}</span>
                        `;
                        comparisonDiv.appendChild(row);
                    }
                    
                    wrap.appendChild(comparisonDiv);
                    container.appendChild(wrap);
                }
            }
        );
    }







});






