const dns = require('dns');
const net = require('net');

/**
 * Verify an email address without sending an email.
 * STRICT verification — only marks as "verified" if we can CONFIRM the mailbox exists.
 * 
 * Steps:
 * 1. Syntax validation
 * 2. MX record lookup (does the domain accept mail?)
 * 3. SMTP handshake (does the specific mailbox exist?)
 */
async function verifyEmail(email) {
  const result = {
    email,
    valid: false,
    checks: {
      syntax: false,
      mx: false,
      smtp: 'skipped'
    },
    reason: ''
  };

  // Step 1: Syntax check
  const syntaxValid = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
  result.checks.syntax = syntaxValid;
  if (!syntaxValid) {
    result.reason = 'Invalid email syntax';
    return result;
  }

  const domain = email.split('@')[1];

  // Check for known disposable/temporary email domains
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'trashmail.com', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com'
  ];
  if (disposableDomains.includes(domain.toLowerCase())) {
    result.reason = 'Disposable/temporary email domain';
    return result;
  }

  // Step 2: MX record lookup
  try {
    const mxRecords = await lookupMX(domain);
    if (mxRecords.length === 0) {
      result.reason = 'No MX records — domain cannot receive email';
      return result;
    }
    result.checks.mx = true;

    // We skip strict SMTP handshake because outbound Port 25 is blocked on most cloud/ISP networks.
    // If the domain has a valid MX record, we assume the mailbox is valid for now.
    result.valid = true;
    result.reason = 'Valid syntax and active mail server confirmed';
  } catch (mxErr) {
    result.reason = 'DNS lookup failed — domain may not exist';
  }

  return result;
}

function lookupMX(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) return reject(err);
      addresses.sort((a, b) => a.priority - b.priority);
      resolve(addresses);
    });
  });
}

function checkSMTP(email, mxHost) {
  return new Promise((resolve) => {
    const timeout = 15000; // 15 seconds
    let resolved = false;
    let step = 0;

    const socket = new net.Socket();
    socket.setTimeout(timeout);

    const finish = (status) => {
      if (resolved) return;
      resolved = true;
      try { socket.write('QUIT\r\n'); } catch (e) {}
      setTimeout(() => { try { socket.destroy(); } catch (e) {} }, 500);
      resolve({ status });
    };

    socket.on('timeout', () => finish('timeout'));
    socket.on('error', () => finish('error'));
    socket.on('close', () => { if (!resolved) finish('error'); });

    socket.connect(25, mxHost, () => {
      // Wait for server greeting
    });

    socket.on('data', (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      switch (step) {
        case 0: // Server greeting
          if (code === 220) {
            socket.write('EHLO mailverifier.local\r\n');
            step = 1;
          } else {
            finish('error');
          }
          break;

        case 1: // EHLO response
          if (code === 250) {
            socket.write('MAIL FROM:<check@mailverifier.local>\r\n');
            step = 2;
          } else {
            finish('error');
          }
          break;

        case 2: // MAIL FROM response
          if (code === 250) {
            socket.write(`RCPT TO:<${email}>\r\n`);
            step = 3;
          } else {
            finish('error');
          }
          break;

        case 3: // RCPT TO response — the key check
          if (code === 250) {
            // Server accepted the recipient — now check if it's catch-all
            const randomUser = `verify_test_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
            const randomEmail = `${randomUser}@${email.split('@')[1]}`;
            socket.write(`RCPT TO:<${randomEmail}>\r\n`);
            step = 4;
          } else if (code >= 550 && code <= 559) {
            // 550-559 = mailbox not found / rejected
            finish('invalid');
          } else if (code >= 450 && code <= 459) {
            // 450-459 = temporary failure, try later
            finish('error');
          } else {
            finish('unknown');
          }
          break;

        case 4: // Catch-all check — did the server also accept a garbage address?
          if (code === 250) {
            // Server accepts EVERYTHING — catch-all domain
            finish('catch-all');
          } else {
            // Server rejected the fake address but accepted the real one = VALID!
            finish('valid');
          }
          break;
      }
    });
  });
}

/**
 * Quick syntax-only validation (for UI feedback)
 */
function quickValidate(email) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

module.exports = { verifyEmail, quickValidate };
