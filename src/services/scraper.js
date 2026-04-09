const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Common pages to check for contact info
const CONTACT_PATHS = [
  '', '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team',
  '/people', '/leadership', '/management', '/company'
];

// Role keywords to look for
const ROLE_KEYWORDS = [
  'founder', 'co-founder', 'cofounder', 'ceo', 'chief executive',
  'cmo', 'chief marketing', 'marketing director', 'marketing head',
  'marketing manager', 'marketing specialist', 'vp marketing',
  'head of marketing', 'director of marketing', 'growth'
];

async function scrapeWebsite(url) {
  const results = [];
  const seenEmails = new Set();

  try {
    const baseUrl = new URL(url);
    const domain = baseUrl.hostname.replace('www.', '');

    for (const pagePath of CONTACT_PATHS) {
      try {
        const pageUrl = `${baseUrl.origin}${pagePath}`;
        const response = await axios.get(pageUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          validateStatus: (status) => status < 400
        });

        const $ = cheerio.load(response.data);
        const html = $.html();
        const text = $('body').text();

        // Extract emails from page text and HTML
        const emailsFromText = text.match(EMAIL_REGEX) || [];
        const emailsFromHTML = html.match(EMAIL_REGEX) || [];

        // Extract emails from mailto links
        const mailtoEmails = [];
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href');
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (email.match(EMAIL_REGEX)) mailtoEmails.push(email);
        });

        const allEmails = [...new Set([...emailsFromText, ...emailsFromHTML, ...mailtoEmails])];

        for (const email of allEmails) {
          const normalizedEmail = email.toLowerCase().trim();
          
          // Filter out common non-person emails and image files
          if (seenEmails.has(normalizedEmail)) continue;
          if (normalizedEmail.endsWith('.png') || normalizedEmail.endsWith('.jpg') || normalizedEmail.endsWith('.svg')) continue;
          if (/^(info|support|help|admin|contact|hello|sales|noreply|no-reply|billing|team|office|careers|jobs|press|media|privacy|legal|abuse|postmaster|webmaster|hostmaster|root|mailer-daemon)@/.test(normalizedEmail)) continue;
          
          seenEmails.add(normalizedEmail);

          // Try to find name/role context near the email
          const context = findContext($, normalizedEmail);

          results.push({
            email: normalizedEmail,
            name: context.name || '',
            role: context.role || '',
            company: domain,
            source: pageUrl
          });
        }
      } catch (err) {
        // Page not found or error - continue to next path
        continue;
      }
    }

    return results;
  } catch (err) {
    console.error(`Failed to scrape ${url}:`, err.message);
    return results;
  }
}

function findContext($, email) {
  let name = '';
  let role = '';

  // Look for the email in the page and find nearby text
  $('*').each((_, el) => {
    const text = $(el).text();
    if (text.includes(email)) {
      // Look at parent/sibling elements for name and role
      const parentText = $(el).parent().text();
      const grandparentText = $(el).parent().parent().text();
      const blockText = parentText.length < 500 ? parentText : grandparentText;

      // Try to extract role
      for (const keyword of ROLE_KEYWORDS) {
        if (blockText.toLowerCase().includes(keyword)) {
          // Find the full role title
          const roleMatch = blockText.match(new RegExp(`[^\\n.]*${keyword}[^\\n.]*`, 'i'));
          if (roleMatch) role = roleMatch[0].trim().substring(0, 100);
          break;
        }
      }

      return false; // break
    }
  });

  return { name, role };
}

// Discover emails using Hunter.io API (if available)
async function discoverWithHunter(domain, targetRoles) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await axios.get(`https://api.hunter.io/v2/domain-search`, {
      params: { domain, api_key: apiKey, limit: 50 }
    });

    const emails = response.data.data.emails || [];
    return emails
      .filter(e => {
        if (!e.position) return false;
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

// Pattern-based email guessing for common formats
async function guessEmails(domain, targetRoles) {
  // Common email patterns for founders/CEOs
  const commonPrefixes = [
    'founder', 'ceo', 'info', 'hello', 'admin',
    'marketing', 'team', 'contact'
  ];

  const results = [];
  for (const prefix of commonPrefixes) {
    results.push({
      email: `${prefix}@${domain}`,
      name: '',
      role: prefix === 'founder' ? 'Founder' : prefix === 'ceo' ? 'CEO' : prefix === 'marketing' ? 'Marketing' : '',
      company: domain,
      confidence: 30
    });
  }

  return results;
}

module.exports = { scrapeWebsite, discoverWithHunter, guessEmails };
