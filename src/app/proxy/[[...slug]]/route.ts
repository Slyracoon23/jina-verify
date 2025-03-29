import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Use environment variables for the key pair
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'your-private-key-change-me';
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'your-public-key-change-me';

interface JwtPayload {
  url: string;
  timestamp: number;
  contentHash: string;
  iat: number;
  exp: number;
}

interface VerificationData {
  url: string;
  timestamp: number;
  contentHash: string;
  signatureToken: string;
  publicKey: string;
}

// Define public asset paths - will be loaded by the browser directly
const VERIFICATION_CSS_PATH = '/verification/styles.css';
const VERIFICATION_JS_PATH = '/verification/script.js';

// Load HTML templates from public folder
const TEMPLATE_DIR = path.join(process.cwd(), 'public', 'verification', 'templates');
const BADGE_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'badge.html'), 'utf-8');
const COPY_BUTTON_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'copy-button.html'), 'utf-8');
const WRAPPER_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'wrapper.html'), 'utf-8');

/**
 * Creates a JWT-like signature token using RS256 (asymmetric crypto).
 */
function createSignatureToken(targetUrl: string, timestamp: number, contentHash: string): string {
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
    if (PRIVATE_KEY !== 'your-private-key-change-me' && PRIVATE_KEY.length > 20) {
      // Format the private key properly if it's not in PEM format
      let privateKeyToUse = PRIVATE_KEY;
      if (!privateKeyToUse.includes('-----BEGIN') && !privateKeyToUse.includes('PRIVATE KEY')) {
        privateKeyToUse = `-----BEGIN PRIVATE KEY-----\n${privateKeyToUse}\n-----END PRIVATE KEY-----`;
      }

      try {
        // Sign using RSA-SHA256 with the private key
        const signature = crypto
          .createSign('RSA-SHA256')
          .update(dataToSign)
          .sign(privateKeyToUse);
        
        // Convert signature to base64url format manually
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
    const hmacKey = PRIVATE_KEY === 'your-private-key-change-me' ? 'development-fallback-key' : PRIVATE_KEY;
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
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates the verification badge HTML from the template.
 */
function createVerificationBadge(data: VerificationData): string {
  const formattedTimestamp = new Date(data.timestamp).toLocaleString();
  
  return BADGE_TEMPLATE
    .replace(/\$\{url\}/g, data.url)
    .replace(/\$\{timestamp\}/g, formattedTimestamp)
    .replace(/\$\{contentHash\}/g, data.contentHash)
    .replace(/\$\{signatureToken\}/g, data.signatureToken)
    .replace(/\$\{publicKey\}/g, data.publicKey);
}

/**
 * Safely escapes HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Injects verification UI into HTML content (badge + copy button + style + meta).
 */
function injectVerificationUI(
  htmlContent: string, 
  signatureWebhook: string, 
  shouldShowVerification: boolean
): string {
  // If content doesn't look like HTML, return as-is
  if (!htmlContent.includes('<!DOCTYPE html>') && !htmlContent.includes('<html')) {
    return htmlContent;
  }

  let updatedContent = htmlContent;

  // Add <meta> + <link> tags for verification and styling
  const headContent = `
    <meta name="x-signature-webhook" content='${signatureWebhook}'>
    <link rel="stylesheet" href="${VERIFICATION_CSS_PATH}">
  `;

  // Insert into an existing <head>, or create a <head> if none
  const headIndex = updatedContent.indexOf('<head>');
  const headEndIndex = updatedContent.indexOf('</head>');
  
  if (headIndex !== -1 && headEndIndex !== -1) {
    // Insert the style/meta content before </head>
    updatedContent =
      updatedContent.slice(0, headEndIndex) +
      headContent +
      updatedContent.slice(headEndIndex);
  } else {
    // If no head tag, insert one
    const htmlTagIndex = updatedContent.indexOf('<html');
    if (htmlTagIndex !== -1) {
      const tagEndIndex = updatedContent.indexOf('>', htmlTagIndex) + 1;
      updatedContent =
        updatedContent.slice(0, tagEndIndex) +
        `\n<head>${headContent}</head>\n` +
        updatedContent.slice(tagEndIndex);
    }
  }

  // If user requested verification UI, inject badge + copy button + JS script tag
  if (shouldShowVerification) {
    const bodyIndex = updatedContent.indexOf('<body');
    if (bodyIndex !== -1) {
      const tagEndIndex = updatedContent.indexOf('>', bodyIndex) + 1;
      const verificationData = JSON.parse(signatureWebhook) as VerificationData;
      updatedContent =
        updatedContent.slice(0, tagEndIndex) +
        createVerificationBadge(verificationData) +
        COPY_BUTTON_TEMPLATE +
        updatedContent.slice(tagEndIndex);
    }

    // Add JavaScript script tag just before closing body tag
    const bodyEndIndex = updatedContent.indexOf('</body>');
    if (bodyEndIndex !== -1) {
      updatedContent =
        updatedContent.slice(0, bodyEndIndex) +
        `<script src="${VERIFICATION_JS_PATH}"></script>` +
        updatedContent.slice(bodyEndIndex);
    }
  }
  
  return updatedContent;
}

/**
 * Wraps non-HTML content in an HTML template with verification UI.
 */
function wrapContentWithSignatureViewer(content: string, signatureWebhook: string): string {
  const verificationData = JSON.parse(signatureWebhook) as VerificationData;
  const verificationBadge = createVerificationBadge(verificationData);
  
  return WRAPPER_TEMPLATE
    .replace(/\$\{signatureWebhook\}/g, signatureWebhook)
    .replace(/\$\{cssPath\}/g, VERIFICATION_CSS_PATH)
    .replace(/\$\{jsPath\}/g, VERIFICATION_JS_PATH)
    .replace(/\$\{verificationBadge\}/g, verificationBadge)
    .replace(/\$\{copyButton\}/g, COPY_BUTTON_TEMPLATE)
    .replace(/\$\{content\}/g, escapeHtml(content));
}

/**
 * Normalizes the URL from slug parts (ensures proper protocol).
 */
function normalizeUrl(slugParts: string[]): string {
  const url = slugParts.join('/');
  return url
    .replace(/^https:\/(?!\/)/, 'https://')
    .replace(/^http:\/(?!\/)/, 'http://');
}

/**
 * GET request handler: reverse proxy to the Jina Reader.
 * Fetches content, signs it, optionally injects the verification UI, and returns the response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug || [];

  // Require a URL in the path
  if (slug.length === 0) {
    return NextResponse.json(
      { error: 'URL is required in the path (e.g., /proxy/https://example.com)' },
      { status: 400 }
    );
  }

  // Check if we should display the verification UI
  const shouldShowVerificationUI = request.nextUrl.searchParams.has('signature');
  const hasPublicKey = request.nextUrl.searchParams.has('publicKey');
  const targetUrl = normalizeUrl(slug);

  try {
    // Validate URL format
    new URL(targetUrl);

    const fetchTimestamp = Date.now();
    const jinaReaderUrl = `https://r.jina.ai/${targetUrl}`;

    // Fetch content from Jina Reader
    const response = await fetch(jinaReaderUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    let contentType = response.headers.get('content-type') || 'text/markdown';
    let content = await response.text();

    // Create verification data
    const contentHash = hashContent(content);
    const signatureToken = createSignatureToken(targetUrl, fetchTimestamp, contentHash);
    const verificationData: VerificationData = {
      url: targetUrl,
      timestamp: fetchTimestamp,
      contentHash,
      signatureToken,
      publicKey: PUBLIC_KEY,
    };
    const signatureWebhook = JSON.stringify(verificationData);

    // If ?signature= is missing or ?publicKey= is missing, redirect to add them
    if (!shouldShowVerificationUI || !hasPublicKey) {
      const currentUrl = request.nextUrl.clone();
      if (!shouldShowVerificationUI) {
        currentUrl.searchParams.set('signature', signatureToken);
      }
      if (!hasPublicKey) {
        currentUrl.searchParams.set('publicKey', PUBLIC_KEY);
      }
      return NextResponse.redirect(currentUrl);
    }

    // Inject verification UI if it's HTML, or wrap if it's non-HTML
    if (contentType.includes('text/html')) {
      content = injectVerificationUI(content, signatureWebhook, shouldShowVerificationUI);
    } else if (shouldShowVerificationUI) {
      content = wrapContentWithSignatureViewer(content, signatureWebhook);
      contentType = 'text/html'; // override to HTML
    }

    // Return proxied content with verification data in headers
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