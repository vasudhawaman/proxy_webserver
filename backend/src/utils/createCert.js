// It dynamically generates fake SSL certificates on the fly for each HTTPS site the user visits, using your own trusted Root CA.
import fs from 'fs';
import forge from 'node-forge';
import path from 'path'

const rootCA = {
  key:fs.readFileSync('/etc/secrets/rootCA.key'),
  cert: fs.readFileSync(path.join(import.meta.dirname,'..','certs/rootCA.crt')).toString(),
};

export function createFakeCert(hostname) {
  const pki = forge.pki;

  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = new Date().getTime().toString();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: hostname },
    { name: 'organizationName', value: 'proxy' }, // valid
    // ❌ Do not use custom or random strings like "sd008"
  ];
  cert.setSubject(attrs);
  cert.setIssuer(pki.certificateFromPem(rootCA.cert).subject.attributes);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: hostname }] },
  ]);

  cert.sign(pki.privateKeyFromPem(rootCA.key), forge.md.sha256.create());

  return {
    cert: pki.certificateToPem(cert),
    key: pki.privateKeyToPem(keys.privateKey),
  };
}
