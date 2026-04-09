const dns = require('dns');
const net = require('net');

/**
 * Verify an email address without sending an email.
 * Three-step process:
 * 1. Syntax validation
 * 2. MX record lookup (does the domain accept mail?)
 * 3. SMTP handshake (does the mailbox exist?)
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

  // Step 2: MX record lookup
  try {
    const mxRecords = await lookupMX(domain);
    if (mxRecords.length === 0) {
      result.reason = 'No MX records found — domain cannot receive email';
      return result;
    }
    result.checks.mx = true;

    // Step 3: SMTP handshake
    try {
      const smtpResult = await checkSMTP(email, mxRecords[0].exchange);
      result.checks.smtp = smtpResult.status;
      
      if (smtpResult.status === 'valid') {
        result.valid = true;
        result.reason = 'Email address exists';
      } else if (smtpResult.status === 'catch-all') {
        result.valid = true; // Treat catch-all as valid
        result.reason = 'Domain accepts all emails (catch-all)';
      } else if (smtpResult.status === 'invalid') {
        result.reason = 'Mailbox does not exist';
      } else {
        // If SMTP check fails/times out, fall back to MX check
        result.valid = true; // MX exists, so likely valid
        result.reason = 'MX records valid — SMTP check inconclusive';
      }
    } catch (smtpErr) {
      // SMTP check failed — but MX exists, so mark as likely valid
      result.valid = true;
      result.checks.smtp = 'error';
      result.reason = 'MX records valid — SMTP check unavailable';
    }
  } catch (mxErr) {
    result.reason = 'DNS lookup failed';
  }

  return result;
}

function lookupMX(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) return reject(err);
      // Sort by priority (lowest = highest priority)
      addresses.sort((a, b) => a.priority - b.priority);
      resolve(addresses);
    });
  });
}

function checkSMTP(email, mxHost) {
  return new Promise((resolve) => {
    const timeout = 10000; // 10 second timeout
    let resolved = false;
    let responseData = '';

    const socket = new net.Socket();
    socket.setTimeout(timeout);

    const finish = (status) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ status });
    };

    socket.on('timeout', () => finish('timeout'));
    socket.on('error', () => finish('error'));

    socket.connect(25, mxHost, () => {
      // Wait for server greeting
    });

    let step = 0;
    socket.on('data', (data) => {
      responseData = data.toString();
      const code = parseInt(responseData.substring(0, 3));

      switch (step) {
        case 0: // Server greeting
          if (code === 220) {
            socket.write('EHLO mail.verifier.local\r\n');
            step = 1;
          } else {
            finish('error');
          }
          break;

        case 1: // EHLO response
          if (code === 250) {
            socket.write('MAIL FROM:<verify@verifier.local>\r\n');
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

        case 3: // RCPT TO response — this tells us if the mailbox exists
          if (code === 250) {
            // Check for catch-all by testing a random address
            const randomEmail = `nonexistent_${Date.now()}@${email.split('@')[1]}`;
            socket.write(`RCPT TO:<${randomEmail}>\r\n`);
            step = 4;
          } else if (code === 550 || code === 551 || code === 552 || code === 553) {
            finish('invalid');
          } else {
            finish('unknown');
          }
          break;

        case 4: // Catch-all check
          socket.write('QUIT\r\n');
          if (code === 250) {
            finish('catch-all'); // Server accepts any email
          } else {
            finish('valid'); // Only the real email was accepted
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
