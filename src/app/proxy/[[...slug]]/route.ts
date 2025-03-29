import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';


// Use an environment variable for the secret key (fallback for development)
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-me-in-production';

interface JwtPayload {
  url: string;
  timestamp: number;
  contentHash: string;
  iat: number;
  exp: number;
}

/**
 * Creates a JWT-like signature token.
 *
 * @param targetUrl - The URL being proxied.
 * @param timestamp - The timestamp when the fetch occurred.
 * @param contentHash - The SHA-256 hash of the fetched content.
 * @returns A JWT-like token string.
 */
function createSignatureToken(targetUrl: string, timestamp: number, contentHash: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

  // Set issued at time and token expiration (e.g., valid for 1 hour)
  const issuedAt = Math.floor(Date.now() / 1000);
  const expirationTime = issuedAt + 3600;

  const payloadObj: JwtPayload = {
    url: targetUrl,
    timestamp,
    contentHash,
    iat: issuedAt,
    exp: expirationTime,
  };

  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Generates a SHA-256 hash for the provided content.
 *
 * @param content - The content to hash.
 * @returns The content hash as a hexadecimal string.
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * GET request handler that acts as a reverse proxy to the Jina Reader.
 */
export async function GET(
  request: NextRequest,
  context: { params: { slug?: string[] } }
) {
  // Destructure the slug array from context parameters
  const { slug = [] } = context.params;

  if (slug.length === 0) {
    return NextResponse.json(
      { error: 'URL is required in the path (e.g., /proxy/https://example.com)' },
      { status: 400 }
    );
  }

  // Reconstruct the full target URL from the slug array.
  // For example: ['https:', '', 'example.com', 'path'] -> 'https://example.com/path'
  let targetUrl = slug.join('/');
  // Fix cases where the protocol separator is missing a slash
  targetUrl = targetUrl
    .replace(/^https:\/(?!\/)/, 'https://')
    .replace(/^http:\/(?!\/)/, 'http://');

  try {
    // Validate the URL format
    new URL(targetUrl);

    const fetchTimestamp = Date.now();
    const jinaReaderUrl = `https://r.jina.ai/${targetUrl}`;

    // Fetch content from the Jina Reader as a reverse proxy
    const response = await fetch(jinaReaderUrl);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch from Jina Reader: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'text/markdown';
    const content = await response.text();
    const contentHash = hashContent(content);
    const signatureToken = createSignatureToken(targetUrl, fetchTimestamp, contentHash);

    // Bundle signature details in a JSON string for the client
    const signatureWebhook = JSON.stringify({
      url: targetUrl,
      timestamp: fetchTimestamp,
      contentHash,
      signatureToken,
    });

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'X-Proxy-By': 'Jina-Style-Proxy',
        'X-Signature-Webhook': signatureWebhook,
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      {
        error: 'Failed to proxy the content',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}