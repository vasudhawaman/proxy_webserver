// Assign a weight to each pattern group
const PATTERN_WEIGHTS = {
  xss: 1.0,                // Highly malicious
  scriptInjection: 1.0,    // Highly malicious
  formHijacking: 0.5,      // Moderately suspicious
  redirects: 0.7,          // Suspicious
  dataExfiltration: 0.9,   // Highly suspicious
  clickjacking: 0.4,       // Might be benign in some cases
  suspiciousAttributes: 0.3, // Possibly benign, often false positives
};

function detectMaliciousHtml(htmlContent) {
  if (typeof htmlContent !== 'string') {
    throw new Error('HTML content must be a string');
  }

  const results = {
    fileType:'HTML',
    totalMaliciousCount: 0,
    weightedMaliciousScore: 0,
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

  // ... [patterns definitions remain the same as before]

  // Count pattern matches and categorize threats (now with weight)
  function countPatterns(patterns, category, description) {
    patterns.forEach((pattern, index) => {
      const matches = htmlContent.match(pattern) || [];
      if (matches.length > 0) {
        results.categories[category] += matches.length;
        results.totalMaliciousCount += matches.length;
        const weight = PATTERN_WEIGHTS[category] || 0.3;
        results.weightedMaliciousScore += matches.length * weight;
        results.detectedThreats.push({
          category: category,
          description: description,
          patternIndex: index,
          count: matches.length,
          weight,
          score: matches.length * weight,
          samples: matches.slice(0, 3),
        });
      }
    });
  }

  // ... [run countPatterns for each group as before]

  // Check for obfuscated content (assign low weight)
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
      const weight = 0.1;
      results.weightedMaliciousScore += 1 * weight;
      results.detectedThreats.push({
        category: 'suspiciousAttributes',
        description: 'Excessive encoded content (potential obfuscation)',
        count: matches.length,
        weight,
        score: 1 * weight,
        samples: matches.slice(0, 3),
      });
    }
  });

  // Weighted risk assessment
  let riskLevel = 'low';
  if (results.weightedMaliciousScore > 10) {
    riskLevel = 'critical';
  } else if (results.weightedMaliciousScore > 5) {
    riskLevel = 'high';
  } else if (results.weightedMaliciousScore > 2) {
    riskLevel = 'medium';
  }

  results.riskLevel = riskLevel;
  results.timestamp = new Date().toISOString();

  return results;
}

export { detectMaliciousHtml };