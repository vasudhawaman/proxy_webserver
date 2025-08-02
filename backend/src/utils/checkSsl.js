export function checkSSL(serverRes) {
  const cert = serverRes.socket.getPeerCertificate();
  let sslTlsStatus = 'Valid SSL certificate';
  let sslDetails = {};

  if (!cert || Object.keys(cert).length === 0) {
    sslTlsStatus = 'No certificate found.';
  } else {
    sslDetails = {
      subject: cert.subject,
      issuer: cert.issuer,
      valid_from: cert.valid_from,
      valid_to: cert.valid_to,
    };

    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    if (now < validFrom || now > validTo) {
      sslTlsStatus = 'SSL certificate is expired or not yet valid';
    }

    if (!serverRes.socket.authorized) {
      sslTlsStatus =
        'SSL certificate is not valid: ' + serverRes.socket.authorizationError;
    }
  }

  return { sslTlsStatus, sslDetails };
}
