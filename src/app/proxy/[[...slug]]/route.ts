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

interface VerificationData {
  url: string;
  timestamp: number;
  contentHash: string;
  signatureToken: string;
}

/**
 * Updated CSS for a cleaner, more professional look.
 */
const VERIFICATION_CSS = `
/* Global reset for toggling, fonts, etc. */
* {
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Verification badge container */
.verification-badge {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  z-index: 9999;
  box-shadow: 0 4px 8px rgba(0,0,0,0.08);
  color: #333;
  cursor: pointer;
  max-width: 360px;
  transition: all 0.2s ease-in-out;
}

.verification-badge:hover {
  box-shadow: 0 6px 12px rgba(0,0,0,0.12);
}

/* Header portion of the badge */
.verification-header {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.verification-header svg {
  margin-right: 8px;
  width: 20px;
  height: 20px;
  stroke: #4caf50;
}

/* Metadata is hidden by default; toggled by JS */
.verification-metadata {
  display: none;
  margin-top: 12px;
  font-size: 0.875rem;
  color: #555;
  line-height: 1.4;
}

.verification-metadata div {
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid #4caf50;
  word-break: break-all;
}

/* Copy button container */
.copy-btn-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
}

/* Copy button styling */
.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #0069d9;
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transition: background 0.2s ease-in-out, transform 0.2s ease-in-out;
}

.copy-button:hover {
  background: #0053aa;
  transform: translateY(-1px);
}

.copy-button:active {
  background: #003d82;
  transform: scale(0.98);
}

.copy-button svg {
  width: 20px;
  height: 20px;
}

/* Copy success message */
.copy-success {
  position: absolute;
  bottom: 55px;
  right: 0;
  background: #333;
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s;
  white-space: nowrap;
}

.copy-success.show {
  opacity: 1;
  transform: translateY(0);
}

/* Content styling for non-HTML responses */
.content {
  margin-top: 20px;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.content pre {
  padding: 15px;
  border-radius: 5px;
  background: #fafafa;
  overflow-x: auto;
  white-space: pre-wrap;
}
`;

/**
 * JavaScript for toggling metadata and copying content.
 */
const TOGGLE_SCRIPT = `
<script>
  function toggleVerificationMetadata() {
    var metadata = document.getElementById('verification-metadata');
    if (metadata.style.display === 'none' || !metadata.style.display) {
      metadata.style.display = 'block';
    } else {
      metadata.style.display = 'none';
    }
  }

  function copyContent(event) {
    event.stopPropagation(); // Prevent toggling the metadata when clicking the button
    
    let contentToCopy = '';
    
    // Check if we're in the wrapped content view (non-HTML content)
    const preElement = document.querySelector('.content pre');
    if (preElement) {
      contentToCopy = preElement.innerText;
    } else {
      // For HTML content, copy the body contents excluding the verification badge
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(document.body.cloneNode(true));
      const badge = tempDiv.querySelector('.verification-badge');
      if (badge) {
        badge.remove();
      }
      const copyBtnContainer = tempDiv.querySelector('.copy-btn-container');
      if (copyBtnContainer) {
        copyBtnContainer.remove();
      }
      contentToCopy = tempDiv.querySelector('body').innerHTML;
    }
    
    navigator.clipboard.writeText(contentToCopy)
      .then(() => {
        const successElem = document.getElementById('copy-success');
        successElem.classList.add('show');
        setTimeout(() => {
          successElem.classList.remove('show');
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy content: ', err);
      });
  }
</script>
`;

/**
 * Creates a JWT-like signature token.
 */
function createSignatureToken(targetUrl: string, timestamp: number, contentHash: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const expirationTime = issuedAt + 3600; // 1 hour from now

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
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates the verification badge HTML, including the toggleable metadata section.
 */
function createVerificationBadge(data: VerificationData): string {
  const formattedTimestamp = new Date(data.timestamp).toLocaleString();
  
  return `
    <div class="verification-badge" onclick="toggleVerificationMetadata()">
      <div class="verification-header">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Verified Content
      </div>
      <div id="verification-metadata" class="verification-metadata">
        <div><strong>URL:</strong> ${data.url}</div>
        <div><strong>Timestamp:</strong> ${formattedTimestamp}</div>
        <div><strong>Content Hash:</strong> ${data.contentHash}</div>
        <div><strong>Signature:</strong> ${data.signatureToken}</div>
      </div>
    </div>
    ${TOGGLE_SCRIPT}
  `;
}

/**
 * Creates a floating copy button at the bottom-right corner.
 */
function createCopyButton(): string {
  return `
    <div class="copy-btn-container">
      <button class="copy-button" onclick="copyContent(event)" title="Copy Page Content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy Content
      </button>
      <span id="copy-success" class="copy-success">Content copied!</span>
    </div>
  `;
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

  // Add <meta> + <style> tags for verification and styling
  const headContent = `
    <meta name="x-signature-webhook" content='${signatureWebhook}'>
    <style>${VERIFICATION_CSS}</style>
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

  // If user requested verification UI, inject badge + copy button
  if (shouldShowVerification) {
    const bodyIndex = updatedContent.indexOf('<body');
    if (bodyIndex !== -1) {
      const tagEndIndex = updatedContent.indexOf('>', bodyIndex) + 1;
      const verificationData = JSON.parse(signatureWebhook) as VerificationData;
      updatedContent =
        updatedContent.slice(0, tagEndIndex) +
        createVerificationBadge(verificationData) +
        createCopyButton() +
        updatedContent.slice(tagEndIndex);
    }
  }
  
  return updatedContent;
}

/**
 * Wraps non-HTML content in an HTML template with verification UI.
 */
function wrapContentWithSignatureViewer(content: string, signatureWebhook: string): string {
  const verificationData = JSON.parse(signatureWebhook) as VerificationData;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="x-signature-webhook" content='${signatureWebhook}'>
        <title>Proxied Content</title>
        <style>${VERIFICATION_CSS}</style>
      </head>
      <body>
        ${createVerificationBadge(verificationData)}
        ${createCopyButton()}
        <div class="content">
          <pre>${escapeHtml(content)}</pre>
        </div>
      </body>
    </html>
  `;
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
 * GET request handler: reverse proxy to the Jina Reader (r.jina.ai).
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
    };
    const signatureWebhook = JSON.stringify(verificationData);

    // If ?signature= is missing, redirect to add it
    if (!shouldShowVerificationUI) {
      const currentUrl = request.nextUrl.clone();
      currentUrl.searchParams.set('signature', signatureToken);
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