function detectMaliciousJS(jsContent) {
  if (typeof jsContent !== 'string') {
    throw new Error('JS content must be a string');
  }

  const results = {
    fileType: 'JavaScript',
    totalMaliciousCount: 0,
    detectedThreats: [],
    categories: {
      dangerousFunctions: 0,
      obfuscation: 0,
      suspiciousVariables: 0,
      suspiciousStrings: 0,
      networkCalls: 0,
      domManipulation: 0,
    },
  };

  // Dangerous JS functions often used maliciously
  const dangerousFunctions = [
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(\s*["'`]/gi,
    /setInterval\s*\(\s*["'`]/gi,
    /execScript\s*\(/gi,
    /document\.write/gi,
    /window\[["']eval["']\]/gi,
  ];

  // Obfuscation patterns: hex, unicode, long variable names, excessive concatenation, etc.
  const obfuscationPatterns = [
    /\\x[0-9a-fA-F]{2}/g,
    /\\u[0-9a-fA-F]{4}/g,
    /[a-zA-Z0-9_$]{20,}/g, // suspiciously long identifiers
    /\+{3,}/g, // excessive concatenation
    /(?:0x)?[0-9a-fA-F]{16,}/g, // suspiciously long hex
  ];

  // Suspicious variable names (commonly used in obfuscated code)
  const suspiciousVarNames = [
    /\b(_0x[a-f0-9]+)\b/gi,
    /\b([a-zA-Z]{1,2}\d{2,})\b/g,
  ];

  // Suspicious strings (data URIs, base64, etc)
  const suspiciousStrings = [
    /['"`]data:[^'"`]+['"`]/gi,
    /['"`][A-Za-z0-9+\/=]{40,}['"`]/g, // long base64-like strings
  ];

  // Network or exfiltration calls
  const networkPatterns = [
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi,
    /navigator\.sendBeacon/gi,
    /WebSocket\s*\(/gi,
    /ActiveXObject\s*\(\s*["']Microsoft\.XMLHTTP["']\s*\)/gi,
  ];

  // DOM manipulation/change
  const domPatterns = [
    /\.innerHTML\s*=/gi,
    /\.outerHTML\s*=/gi,
    /\.insertAdjacentHTML\s*\(/gi,
    /document\.createElement\s*\(\s*["']script["']\s*\)/gi,
    /document\.cookie/gi,
  ];

  function countPatterns(patterns, category, description) {
    patterns.forEach((pattern, index) => {
      const matches = jsContent.match(pattern) || [];
      if (matches.length > 0) {
        results.categories[category] += matches.length;
        results.totalMaliciousCount += matches.length;
        results.detectedThreats.push({
          category,
          description,
          patternIndex: index,
          count: matches.length,
          samples: matches.slice(0, 3),
        });
      }
    });
  }

  countPatterns(
    dangerousFunctions,
    'dangerousFunctions',
    'Dangerous JS functions'
  );
  countPatterns(obfuscationPatterns, 'obfuscation', 'Obfuscation patterns');
  countPatterns(
    suspiciousVarNames,
    'suspiciousVariables',
    'Suspicious variable names'
  );
  countPatterns(
    suspiciousStrings,
    'suspiciousStrings',
    'Suspicious strings (data/base64)'
  );
  countPatterns(
    networkPatterns,
    'networkCalls',
    'Network or exfiltration calls'
  );
  countPatterns(
    domPatterns,
    'domManipulation',
    'DOM manipulation or cookie access'
  );

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
function getMaliciousJSCount(jsContent) {
  return detectMaliciousJS(jsContent).totalMaliciousCount;
}

// ES Module exports
export { detectMaliciousJS, getMaliciousJSCount };
