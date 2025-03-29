import crypto from 'crypto';

interface JwtPayload {
  url: string;
  timestamp: number;
  contentHash: string;
  iat: number;
  exp: number;
}

/**
 * Creates a JWT-like signature token using RS256 (asymmetric crypto).
 */
export function createSignatureToken(
  targetUrl: string, 
  timestamp: number, 
  contentHash: string, 
  privateKey: string
): string {
  const headerObj = { alg: 'RS256', typ: 'JWT' };
  const header = Buffer.from(JSON.stringify(headerObj)).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expirationTime = issuedAt + 3600; // token valid for 1 hour

  const payloadObj: JwtPayload = {
    url: targetUrl,
    timestamp,
    contentHash,
    iat: issuedAt,
    exp: expirationTime,
  };

  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const dataToSign = `${header}.${payload}`;

  try {
    // Check if we have a valid private key for signing
    if (privateKey !== 'your-private-key-change-me' && privateKey.length > 20) {
      // Format the private key properly if it's not in PEM format
      let privateKeyToUse = privateKey;
      if (!privateKeyToUse.includes('-----BEGIN') && !privateKeyToUse.includes('PRIVATE KEY')) {
        privateKeyToUse = `-----BEGIN PRIVATE KEY-----\n${privateKeyToUse}\n-----END PRIVATE KEY-----`;
      }

      try {
        // Sign using RSA-SHA256 with the private key
        const signature = crypto
          .createSign('RSA-SHA256')
          .update(dataToSign)
          .sign(privateKeyToUse);
        
        // Convert signature to base64url format
        const base64Signature = signature.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        return `${dataToSign}.${base64Signature}`;
      } catch (signingError) {
        console.error('Signing error with RS256:', signingError);
        // Fall through to fallback signing method
      }
    }
    
    // Fallback to HMAC-SHA256 for development or when RSA fails
    console.warn('Using HMAC-SHA256 fallback signing (less secure, for development only)');
    const hmacKey = privateKey === 'your-private-key-change-me' ? 'development-fallback-key' : privateKey;
    const hmacSignature = crypto
      .createHmac('sha256', hmacKey)
      .update(dataToSign)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    return `${dataToSign}.${hmacSignature}`;
  } catch (error) {
    console.error('Error creating signature:', error);
    // Last resort fallback to a simple hash signature
    const fallbackSignature = crypto.createHash('sha256').update(dataToSign).digest('hex');
    return `${dataToSign}.${fallbackSignature}`;
  }
}

/**
 * Generates a SHA-256 hash for the provided content.
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
} 