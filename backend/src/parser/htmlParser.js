function detectMaliciousCode(htmlContent) {
  if (typeof htmlContent !== 'string') {
    throw new Error('HTML content must be a string');
  }

  const results = {
    totalMaliciousCount: 0,
    detectedThreats: [],
    categories: {
      xss: 0,
      scriptInjection: 0,
      formHijacking: 0,
      redirects: 0,
      dataExfiltration: 0,
      clickjacking: 0,
      suspiciousAttributes: 0,
    },
  };

  const lowerContent = htmlContent.toLowerCase();

  // XSS attack patterns
  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<applet[^>]*>/gi,
    /vbscript:/gi,
    /expression\s*\(/gi,
    /@import/gi,
  ];

  // Malicious JavaScript functions
  const scriptPatterns = [
    /eval\s*\(/gi,
    /document\.write/gi,
    /document\.writeln/gi,
    /innerHTML\s*=/gi,
    /outerHTML\s*=/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    /Function\s*\(/gi,
    /new\s+Function/gi,
    /execScript/gi,
  ];

  // Form hijacking attempts
  const formPatterns = [
    /<form[^>]*action\s*=\s*["']https?:\/\/(?![\w.-]*(?:localhost|127\.0\.0\.1|your-domain\.com))/gi,
    /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi,
    /method\s*=\s*["']post["']/gi,
  ];

  // Unauthorized redirects
  const redirectPatterns = [
    /window\.location\s*=/gi,
    /location\.href\s*=/gi,
    /location\.replace/gi,
    /history\.pushState/gi,
    /history\.replaceState/gi,
    /<meta[^>]*http-equiv\s*=\s*["']refresh["']/gi,
  ];

  // Data theft patterns
  const dataExfiltrationPatterns = [
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi,
    /\.send\s*\(/gi,
    /navigator\.sendBeacon/gi,
    /websocket/gi,
    /eventSource/gi,
    /postMessage/gi,
  ];

  // Clickjacking indicators
  const clickjackingPatterns = [
    /frameborder\s*=\s*["']0["']/gi,
    /allowtransparency\s*=\s*["']true["']/gi,
    /style\s*=\s*["'][^"']*opacity\s*:\s*0/gi,
    /style\s*=\s*["'][^"']*visibility\s*:\s*hidden/gi,
    /style\s*=\s*["'][^"']*position\s*:\s*absolute/gi,
  ];

  // Dangerous HTML attributes
  const suspiciousAttributes = [
    /data-[\w-]*\s*=\s*["'][^"']*(?:script|eval|function)/gi,
    /style\s*=\s*["'][^"']*expression/gi,
    /href\s*=\s*["']data:/gi,
    /src\s*=\s*["']data:/gi,
    /formaction\s*=/gi,
  ];

  // Count pattern matches and categorize threats
  function countPatterns(patterns, category, description) {
    patterns.forEach((pattern, index) => {
      const matches = htmlContent.match(pattern) || [];
      if (matches.length > 0) {
        results.categories[category] += matches.length;
        results.totalMaliciousCount += matches.length;
        results.detectedThreats.push({
          category: category,
          description: description,
          patternIndex: index,
          count: matches.length,
          samples: matches.slice(0, 3),
        });
      }
    });
  }

  // Run pattern analysis
  countPatterns(xssPatterns, 'xss', 'Cross-Site Scripting (XSS) patterns');
  countPatterns(
    scriptPatterns,
    'scriptInjection',
    'Suspicious JavaScript injection'
  );
  countPatterns(formPatterns, 'formHijacking', 'Potential form hijacking');
  countPatterns(redirectPatterns, 'redirects', 'Suspicious redirects');
  countPatterns(
    dataExfiltrationPatterns,
    'dataExfiltration',
    'Data exfiltration patterns'
  );
  countPatterns(
    clickjackingPatterns,
    'clickjacking',
    'Clickjacking indicators'
  );
  countPatterns(
    suspiciousAttributes,
    'suspiciousAttributes',
    'Suspicious HTML attributes'
  );

  // Check for obfuscated content
  const encodedPatterns = [
    /&#x[0-9a-f]+;/gi,
    /&#\d+;/gi,
    /%[0-9a-f]{2}/gi,
    /\\u[0-9a-f]{4}/gi,
    /\\x[0-9a-f]{2}/gi,
  ];

  encodedPatterns.forEach((pattern) => {
    const matches = htmlContent.match(pattern) || [];
    if (matches.length > 10) {
      results.categories.suspiciousAttributes += 1;
      results.totalMaliciousCount += 1;
      results.detectedThreats.push({
        category: 'suspiciousAttributes',
        description: 'Excessive encoded content (potential obfuscation)',
        count: matches.length,
        samples: matches.slice(0, 3),
      });
    }
  });

  // Determine risk level
  let riskLevel = 'low';
  if (results.totalMaliciousCount > 20) {
    riskLevel = 'critical';
  } else if (results.totalMaliciousCount > 10) {
    riskLevel = 'high';
  } else if (results.totalMaliciousCount > 5) {
    riskLevel = 'medium';
  }

  results.riskLevel = riskLevel;
  results.timestamp = new Date().toISOString();

  return results;
}

// Simple count-only version
function getMaliciousCodeCount(htmlContent) {
  return detectMaliciousCode(htmlContent).totalMaliciousCount;
}

// ES Module exports
export { detectMaliciousCode, getMaliciousCodeCount };
