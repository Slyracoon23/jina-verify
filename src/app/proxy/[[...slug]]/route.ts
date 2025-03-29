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

// Common CSS for verification UI - used in multiple places
const VERIFICATION_CSS = `
.verification-badge {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(33, 33, 33, 0.8);
  border: 1px solid #444;
  padding: 12px;
  border-radius: 8px;
  z-index: 9999;
  box-shadow: 0 3px 6px rgba(0,0,0,0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 350px;
  cursor: pointer;
  color: #f0f0f0;
  backdrop-filter: blur(5px);
}
.verification-badge strong {
  color: #4caf50;
  display: flex;
  align-items: center;
  font-size: 1.1em;
  margin-bottom: 8px;
}
.verification-badge strong:before {
  content: "✓";
  display: inline-block;
  margin-right: 8px;
  color: #4caf50;
  font-weight: bold;
}
.verification-metadata {
  margin-top: 8px;
  font-size: 0.9em;
  color: #ccc;
}
.verification-metadata div {
  margin-bottom: 8px;
  word-break: break-all;
  border-left: 2px solid #444;
  padding-left: 8px;
}
.copy-btn-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
}
.copy-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  height: 44px;
  border-radius: 22px;
  background: #2196F3;
  color: white;
  border: none;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: all 0.2s;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  font-weight: 500;
  gap: 8px;
}
.copy-button:hover {
  background: #1976D2;
  transform: scale(1.05);
}
.copy-button:active {
  background: #0D47A1;
  transform: scale(0.95);
}
.copy-button svg {
  width: 24px;
  height: 24px;
}
.copy-success {
  position: absolute;
  bottom: 55px;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s;
  white-space: nowrap;
}
.copy-success.show {
  opacity: 1;
  transform: translateY(0);
}
pre { white-space: pre-wrap; }
`;

// Common JavaScript for toggling metadata
const TOGGLE_SCRIPT = `
<script>
  function toggleVerificationMetadata() {
    var elem = document.getElementById('verification-metadata');
    if (elem.style.display === 'none') {
      elem.style.display = 'block';
    } else {
      elem.style.display = 'none';
    }
  }

  function copyContent(event) {
    event.stopPropagation(); // Prevent toggling the metadata when clicking the button
    
    // Find the main content element based on context
    let contentToCopy = '';
    
    // Check if we're in the wrapped content view (non-HTML content)
    const preElement = document.querySelector('.content pre');
    if (preElement) {
      contentToCopy = preElement.innerText;
    } else {
      // For HTML content, copy the body contents excluding the verification badge
      const badgeClone = document.querySelector('.verification-badge').cloneNode(true);
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(document.body.cloneNode(true));
      const badge = tempDiv.querySelector('.verification-badge');
      if (badge) {
        badge.remove();
      }
      contentToCopy = tempDiv.querySelector('body').innerHTML;
    }
    
    navigator.clipboard.writeText(contentToCopy).then(() => {
      const successElem = document.getElementById('copy-success');
      successElem.classList.add('show');
      setTimeout(() => {
        successElem.classList.remove('show');
      }, 2000);
    }).catch(err => {
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
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Creates the verification badge HTML
 */
function createVerificationBadge(data: VerificationData): string {
  const formattedTimestamp = new Date(data.timestamp).toLocaleString();
  
  return `
    <div class="verification-badge" onclick="toggleVerificationMetadata()">
      <strong>Verified Content</strong>
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
 * Creates a copy button that floats at the bottom corner
 */
function createCopyButton(): string {
  return `
    <div class="copy-btn-container">
      <button class="copy-button" onclick="copyContent(event)" title="Copy Content">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
        </svg>
        Copy Content
      </button>
      <span id="copy-success" class="copy-success">Content copied!</span>
    </div>
  `;
}

/**
 * Escapes HTML special characters in text.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;");
}

/**
 * Injects verification metadata into HTML content
 */
function injectVerificationUI(
  htmlContent: string, 
  signatureWebhook: string, 
  shouldShowVerification: boolean
): string {
  // If content is not HTML, just return it as is
  if (!htmlContent.includes('<!DOCTYPE html>') && !htmlContent.includes('<html')) {
    return htmlContent;
  }

  let updatedContent = htmlContent;
  const headContent = `
    <meta name="x-signature-webhook" content='${signatureWebhook}'>
    <link id="verification-styles" rel="stylesheet" href="/proxy/verification.css">
    <style>${VERIFICATION_CSS}</style>
  `;

  // Insert into existing head tag or create one
  const headIndex = updatedContent.indexOf('<head>');
  const headEndIndex = updatedContent.indexOf('</head>');
  
  if (headIndex !== -1 && headEndIndex !== -1) {
    updatedContent = updatedContent.slice(0, headEndIndex) + headContent + updatedContent.slice(headEndIndex);
  } else {
    const htmlTagIndex = updatedContent.indexOf('<html');
    if (htmlTagIndex !== -1) {
      const tagEndIndex = updatedContent.indexOf('>', htmlTagIndex) + 1;
      updatedContent = updatedContent.slice(0, tagEndIndex) + 
                      `\n<head>${headContent}</head>\n` + 
                      updatedContent.slice(tagEndIndex);
    }
  }

  // Inject badge if requested
  if (shouldShowVerification) {
    const bodyIndex = updatedContent.indexOf('<body');
    if (bodyIndex !== -1) {
      const tagEndIndex = updatedContent.indexOf('>', bodyIndex) + 1;
      const verificationData = JSON.parse(signatureWebhook) as VerificationData;
      updatedContent = updatedContent.slice(0, tagEndIndex) + 
                      createVerificationBadge(verificationData) + 
                      createCopyButton() +
                      updatedContent.slice(tagEndIndex);
    }
  }
  
  return updatedContent;
}

/**
 * Wraps non-HTML content in a basic HTML template with verification UI
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
        <style>${VERIFICATION_CSS}
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          margin: 0;
        }
        .content {
          margin-top: 20px;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #444;
        }
        pre {
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        </style>
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
 * Normalizes URL from slug parts
 */
function normalizeUrl(slugParts: string[]): string {
  const url = slugParts.join('/');
  return url
    .replace(/^https:\/(?!\/)/, 'https://')
    .replace(/^http:\/(?!\/)/, 'http://');
}

/**
 * GET request handler that acts as a reverse proxy to the Jina Reader.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  // Await params before using its properties
  const resolvedParams = await params;
  const slug = resolvedParams.slug || [];

  // Error if no URL provided
  if (slug.length === 0) {
    return NextResponse.json(
      { error: 'URL is required in the path (e.g., /proxy/https://example.com)' },
      { status: 400 }
    );
  }

  // Check for UI display option - we'll always generate the signature
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
    
    // Always create verification data
    const contentHash = hashContent(content);
    const signatureToken = createSignatureToken(targetUrl, fetchTimestamp, contentHash);
    const verificationData: VerificationData = {
      url: targetUrl,
      timestamp: fetchTimestamp,
      contentHash,
      signatureToken,
    };
    const signatureWebhook = JSON.stringify(verificationData);

    // Redirect to add signature parameter if not present
    if (!shouldShowVerificationUI) {
      const currentUrl = request.nextUrl.clone();
      currentUrl.searchParams.set('signature', signatureToken);
      return NextResponse.redirect(currentUrl);
    }

    // Modify content based on content type and UI display preference
    if (contentType.includes('text/html')) {
      // Always inject signature metadata, but only show verification UI if requested
      content = injectVerificationUI(content, signatureWebhook, shouldShowVerificationUI);
    } else if (shouldShowVerificationUI) {
      // For non-HTML content, wrap with verification UI if requested
      content = wrapContentWithSignatureViewer(content, signatureWebhook);
      contentType = 'text/html'; // override content type to HTML
    }

    // Return the content with appropriate headers
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