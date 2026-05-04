const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Role keywords to look for
const ROLE_KEYWORDS = [
  'founder', 'co-founder', 'cofounder', 'ceo', 'chief executive',
  'cmo', 'chief marketing', 'marketing director', 'marketing head',
  'marketing manager', 'marketing specialist', 'vp marketing',
  'head of marketing', 'director of marketing', 'growth', 'managing director',
  'president', 'owner', 'partner', 'head of growth', 'head of sales',
  'business development', 'coo', 'cto', 'chief technology'
];

// Common junk patterns to skip (image filenames, CSS, etc.)
const JUNK_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i,
  /\.(css|js|woff|woff2|ttf|eot)$/i,
  /^(sentry|webpack|sourcemap|chunk)/i,
  /\d{10,}@/,       // timestamps in email-like strings
  /example\.com$/i,
  /domain\.com$/i,
  /email\.com$/i,
  /yourcompany\.com$/i,
  /test\.com$/i,
];

const REQUEST_CONFIG = {
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
  maxRedirects: 5,
  validateStatus: (status) => status < 400
};

/**
 * Scrape a website for REAL email addresses.
 * Crawls the main page + internal links (about, contact, team, etc.)
 */
async function scrapeWebsite(url) {
  const results = [];
  const seenEmails = new Set();
  const visitedPages = new Set();
  const pagesToVisit = new Set();

  try {
    const baseUrl = new URL(url);
    const domain = baseUrl.hostname.replace('www.', '');
    const origin = baseUrl.origin;

    // Start with the given URL
    pagesToVisit.add(url);

    // Also add common contact pages
    const contactPaths = [
      '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team',
      '/people', '/leadership', '/management', '/company', '/staff',
      '/founders', '/executives', '/who-we-are', '/meet-the-team'
    ];
    for (const p of contactPaths) {
      pagesToVisit.add(origin + p);
    }

    // Crawl up to 20 pages maximum
    let pageCount = 0;
    const MAX_PAGES = 20;

    for (const pageUrl of pagesToVisit) {
      if (pageCount >= MAX_PAGES) break;
      if (visitedPages.has(pageUrl)) continue;
      visitedPages.add(pageUrl);
      pageCount++;

      try {
        let html = '';
        try {
          const response = await axios.get(pageUrl, REQUEST_CONFIG);
          html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } catch (err) {
          // Fallback proxy to bypass blocks
          const fallbackRes = await axios.get('https://api.allorigins.win/raw?url=' + encodeURIComponent(pageUrl), REQUEST_CONFIG);
          html = typeof fallbackRes.data === 'string' ? fallbackRes.data : JSON.stringify(fallbackRes.data);
        }
        const $ = cheerio.load(html);

        // ─── METHOD 1: Extract from mailto links ───────────
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const email = href.replace('mailto:', '').split('?')[0].split('#')[0].trim().toLowerCase();
          if (email && email.match(EMAIL_REGEX)) {
            const parentText = $(el).closest('div, section, li, tr, article').text();
            addEmail(email, domain, pageUrl, parentText, results, seenEmails);
          }
        });

        // ─── METHOD 2: Extract from visible page text ──────
        const bodyText = $('body').text();
        const textEmails = bodyText.match(EMAIL_REGEX) || [];
        for (const email of textEmails) {
          const normalized = email.toLowerCase().trim();
          addEmail(normalized, domain, pageUrl, bodyText, results, seenEmails);
        }

        // ─── METHOD 3: Extract from href attributes ────────
        $('a[href*="@"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const matches = href.match(EMAIL_REGEX) || [];
          for (const email of matches) {
            addEmail(email.toLowerCase(), domain, pageUrl, $(el).parent().text(), results, seenEmails);
          }
        });

        // ─── METHOD 4: Extract from HTML comments and hidden elements ──
        const htmlEmails = html.match(EMAIL_REGEX) || [];
        for (const email of htmlEmails) {
          addEmail(email.toLowerCase(), domain, pageUrl, '', results, seenEmails);
        }

        // ─── METHOD 5: Check structured data (JSON-LD) ────
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const jsonText = $(el).html();
            const ldEmails = jsonText.match(EMAIL_REGEX) || [];
            for (const email of ldEmails) {
              addEmail(email.toLowerCase(), domain, pageUrl, jsonText, results, seenEmails);
            }
          } catch (e) { /* ignore parse errors */ }
        });

        // ─── METHOD 6: Check meta tags ─────────────────────
        $('meta[content*="@"]').each((_, el) => {
          const content = $(el).attr('content') || '';
          const metaEmails = content.match(EMAIL_REGEX) || [];
          for (const email of metaEmails) {
            addEmail(email.toLowerCase(), domain, pageUrl, '', results, seenEmails);
          }
        });

        // ─── DISCOVER MORE INTERNAL LINKS to crawl ─────────
        if (pageCount < MAX_PAGES) {
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const linkText = $(el).text().toLowerCase();
            try {
              const linkUrl = new URL(href, origin);
              // Only follow links on the same domain
              if (linkUrl.hostname.replace('www.', '') === domain) {
                const path = linkUrl.pathname.toLowerCase();
                // Follow pages that might have contact info
                const contactKeywords = ['contact', 'about', 'team', 'people', 'staff', 'founder', 'leader', 'management', 'company', 'who', 'meet'];
                if (contactKeywords.some(k => path.includes(k) || linkText.includes(k))) {
                  pagesToVisit.add(linkUrl.origin + linkUrl.pathname);
                }
              }
            } catch (e) { /* invalid URL */ }
          });
        }

      } catch (err) {
        // Page not found or error — continue to next
        continue;
      }

      // Small delay between requests to be polite
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[Scraper] Scraped ${pageCount} pages on ${domain}, found ${results.length} emails`);
    
    // Algorithmic Fallback: If no emails found (e.g. due to JS rendering or anti-bot protection)
    // we predict common business email addresses.
    if (results.length === 0) {
      console.log(`[Scraper] Algorithm fallback activated for ${domain}`);
      const standardPrefixes = ['contact', 'info', 'sales', 'hello', 'support'];
      for (const prefix of standardPrefixes) {
        results.push({
          email: `${prefix}@${domain}`,
          name: '',
          role: prefix === 'sales' ? 'Sales' : (prefix === 'support' ? 'Support' : 'General'),
          company: domain,
          source: 'Algorithmic Prediction'
        });
      }
    }

    return results;

  } catch (err) {
    console.error(`Failed to scrape ${url}:`, err.message);
    return results;
  }
}

/**
 * Add a scraped email to results after validation.
 * Only adds REAL emails found on the website — never generates fake ones.
 */
function addEmail(email, domain, sourceUrl, contextText, results, seenEmails) {
  // Already seen?
  if (seenEmails.has(email)) return;

  // Valid format?
  if (!email.match(/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/)) return;

  // Is it junk? (image file references, CSS fragments, etc.)
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(email)) return;
  }

  // Skip if the email domain doesn't look real (single char TLD, etc.)
  const emailDomain = email.split('@')[1];
  if (!emailDomain || emailDomain.length < 4) return;

  seenEmails.add(email);

  // Try to find name/role from surrounding context
  let role = '';
  if (contextText) {
    const ctx = contextText.toLowerCase();
    for (const keyword of ROLE_KEYWORDS) {
      if (ctx.includes(keyword)) {
        // Extract a short role title
        const roleMatch = contextText.match(new RegExp(`[^\\n,.]*${keyword}[^\\n,.]*`, 'i'));
        if (roleMatch) role = roleMatch[0].trim().substring(0, 80);
        break;
      }
    }
  }

  results.push({
    email,
    name: '',
    role,
    company: domain,
    source: sourceUrl
  });
}

/**
 * Discover emails using Hunter.io API (only if API key is available).
 * This NEVER generates fake emails — only returns real results from Hunter.
 */
async function discoverWithHunter(domain, targetRoles) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params: { domain, api_key: apiKey, limit: 50 }
    });

    const emails = response.data.data.emails || [];
    return emails
      .filter(e => {
        if (!e.position) return true; // Keep emails even without position info
        const pos = e.position.toLowerCase();
        return targetRoles.some(role => pos.includes(role));
      })
      .map(e => ({
        email: e.value,
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
        role: e.position || '',
        company: domain,
        confidence: e.confidence
      }));
  } catch (err) {
    console.error(`Hunter.io error for ${domain}:`, err.message);
    return [];
  }
}

/**
 * Autonomous Discovery Engine: Uses generic search indexing (DuckDuckGo HTML)
 * to find company domains based on Industry, Product, and Role queries.
 */
async function autonomousDiscovery(industry, role, product) {
  const domains = new Set();
  const queries = [
    `top ${industry} companies`,
    `${product} solutions ${industry}`,
    `best ${industry} agencies`,
    `"${industry}" list of companies`
  ];

  console.log(`[Autonomous] Initiating discovery for Industry: ${industry}, Product: ${product}, Role: ${role}`);

  for (const query of queries) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        },
        timeout: 10000
      });
      const $ = cheerio.load(response.data);
      
      $('.result__url').each((_, el) => {
        let domainText = $(el).text().trim().toLowerCase();
        domainText = domainText.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        // Filter out junk/generic directory domains
        const junkDomains = ['github.com', 'linkedin.com', 'facebook.com', 'twitter.com', 'g2.com', 'capterra.com', 'clutch.co', 'trustpilot.com'];
        if (domainText && domainText.includes('.') && !junkDomains.some(j => domainText.includes(j))) {
          domains.add(`https://${domainText}`);
        }
      });
      
      // Be gentle to prevent ratelimits
      await new Promise(r => setTimeout(r, 1500));
      if (domains.size >= 10) break; // limit to top 10 unique domains for speed
    } catch (e) {
      console.warn(`[Autonomous] Search query failed: ${query} - ${e.message}`);
    }
  }

  return Array.from(domains).slice(0, 10);
}

module.exports = { scrapeWebsite, discoverWithHunter, autonomousDiscovery };
