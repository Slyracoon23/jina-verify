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
  border-radius: 12px;
  padding: 16px;
  z-index: 9999;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  color: #333;
  cursor: pointer;
  width: 550px;
  max-width: 90vw;
  transition: all 0.2s ease-in-out;
}

.verification-badge:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
}

/* Header portion of the badge */
.verification-header {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2e7d32;
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: 0;
}

.verification-header svg {
  margin-right: 12px;
  width: 28px;
  height: 28px;
  stroke: #2e7d32;
  stroke-width: 2.5;
}

/* Metadata is hidden by default and can be toggled */
.verification-metadata {
  display: none;
  margin-top: 12px;
  font-size: 1rem;
  color: #555;
  line-height: 1.5;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.3s, transform 0.3s;
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.verification-metadata.visible {
  opacity: 1;
  transform: translateY(0);
}

.verification-metadata div {
  margin-bottom: 16px;
  padding: 12px;
  border-left: 4px solid #4caf50;
  word-break: break-all;
  background-color: #f9f9f9;
  border-radius: 0 8px 8px 0;
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
  transition: opacity 0.3s, transform 0.3s, visibility 0.3s;
  white-space: nowrap;
  visibility: hidden;
}

.copy-success.show {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
}

/* Copyable field styling */
.copyable-field {
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 8px;
}

.copyable-field strong {
  display: block;
  margin-bottom: 6px;
  color: #2e7d32;
}

.copyable-field:hover {
  background-color: rgba(76, 175, 80, 0.08);
}

.copyable-field:active {
  background-color: rgba(76, 175, 80, 0.15);
  transform: translateY(1px);
}

.copyable-field::after {
  content: "Click to copy";
  position: absolute;
  right: 12px;
  top: 12px;
  font-size: 0.8rem;
  color: #fff;
  background: #4caf50;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.copyable-field:hover::after {
  opacity: 1;
}

/* Field copy success message */
.field-copy-success {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  background: #333;
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  z-index: 10000;
  transition: transform 0.3s ease, opacity 0.3s, visibility 0.3s;
  white-space: nowrap;
  visibility: hidden;
  opacity: 0;
}

.field-copy-success.show {
  transform: translateX(-50%) translateY(0);
  visibility: visible;
  opacity: 1;
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

/* Responsive design for smaller screens */
@media (max-width: 768px) {
  .verification-badge {
    width: 95vw;
    left: 2.5vw;
    right: 2.5vw;
    top: 10px;
    padding: 12px;
  }
  
  .verification-header {
    font-size: 1.1rem;
    margin-bottom: 0;
  }
  
  .verification-metadata {
    font-size: 0.9rem;
  }
  
  .verification-metadata div {
    padding: 8px;
    margin-bottom: 12px;
  }
  
  .copy-btn-container {
    bottom: 10px;
    right: 10px;
  }
}

@media (max-width: 480px) {
  .verification-badge {
    padding: 10px;
  }
  
  .verification-header svg {
    width: 22px;
    height: 22px;
  }
  
  .copyable-field::after {
    content: "Copy";
    padding: 2px 6px;
    font-size: 0.7rem;
  }
}

/* Add a toggle button style */
.toggle-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.2);
  color: #2e7d32;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(76, 175, 80, 0.15);
}

.toggle-btn svg {
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
}

.toggle-btn.expanded svg {
  transform: rotate(180deg);
}
`;

/**
 * JavaScript for toggling metadata and copying content.
 */
const TOGGLE_SCRIPT = `
<script>
  // Parse the JWT-like token
  function parseToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return {
        header: JSON.parse(atob(parts[0])),
        payload,
        signature: parts[2]
      };
    } catch (e) {
      console.error('Error parsing token:', e);
      return null;
    }
  }

  // Get verification data from meta tag
  function getVerificationData() {
    const meta = document.querySelector('meta[name="x-signature-webhook"]');
    if (!meta) return null;
    
    try {
      return JSON.parse(meta.content);
    } catch (e) {
      console.error('Error parsing verification data:', e);
      return null;
    }
  }

  // Compute hash of the current content
  async function computeContentHash() {
    let content = '';
    
    // Get content based on what type of view we're in
    const preElement = document.querySelector('.content pre');
    if (preElement) {
      // Non-HTML content (in the wrapper)
      content = preElement.innerText;
    } else {
      // HTML content - get it without the verification UI
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(document.body.cloneNode(true));
      
      // Remove verification UI elements
      const badge = tempDiv.querySelector('.verification-badge');
      if (badge) badge.remove();
      
      const copyBtnContainer = tempDiv.querySelector('.copy-btn-container');
      if (copyBtnContainer) copyBtnContainer.remove();
      
      content = tempDiv.querySelector('body').innerHTML;
    }
    
    // Use Web Crypto API to compute SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert hash to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }
  
  // Verify all conditions
  async function verifyContent() {
    const data = getVerificationData();
    if (!data) {
      updateBadgeStatus(false, "No verification data found");
      return;
    }
    
    // Parse the token
    const tokenData = parseToken(data.signatureToken);
    if (!tokenData) {
      updateBadgeStatus(false, "Invalid signature token format");
      return;
    }
    
    // 1. Check if URL matches
    const urlMatches = data.url === tokenData.payload.url;
    
    // 2. Check content hash
    const computedHash = await computeContentHash();
    const contentMatches = data.contentHash === computedHash;
    
    // 3. Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    const notExpired = tokenData.payload.exp > currentTime;
    
    // 4. Validate JWT signature
    // Note: For a complete implementation, we'd need to:
    // 1. Have the secret key available on the client (or use asymmetric keys)
    // 2. Use Web Crypto API to verify HMAC
    // For this demo, we'll consider the signature check as part of the token format
    
    // Update badge status
    if (urlMatches && contentMatches && notExpired) {
      updateBadgeStatus(true, "Content verified successfully");
    } else {
      let errorMessage = "Verification failed: ";
      if (!urlMatches) errorMessage += "URL mismatch. ";
      if (!contentMatches) errorMessage += "Content hash mismatch. ";
      if (!notExpired) errorMessage += "Signature expired. ";
      
      updateBadgeStatus(false, errorMessage.trim());
    }
  }
  
  // Update badge UI based on verification
  function updateBadgeStatus(isVerified, message) {
    const badge = document.querySelector('.verification-badge');
    const header = document.querySelector('.verification-header');
    
    if (!badge || !header) return;
    
    if (isVerified) {
      badge.style.borderColor = '#4caf50';
      header.innerHTML = \`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Verified Content
      \`;
      header.style.color = '#4caf50';
    } else {
      badge.style.borderColor = '#f44336';
      header.innerHTML = \`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        Verification Failed
      \`;
      header.style.color = '#f44336';
      
      // Add error message to metadata
      const metadata = document.getElementById('verification-metadata');
      if (metadata) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = \`<strong>Error:</strong> \${message}\`;
        errorDiv.style.borderLeft = '3px solid #f44336';
        metadata.prepend(errorDiv);
      }
    }
  }

  // Copy text to clipboard
  function copyToClipboard(text, event) {
    // Stop event propagation to prevent toggling the metadata
    event.stopPropagation();
    
    // Copy to clipboard
    navigator.clipboard.writeText(text)
      .then(() => {
        // Create or get the notification element
        let notification = document.getElementById('field-copy-notification');
        if (!notification) {
          notification = document.createElement('div');
          notification.id = 'field-copy-notification';
          notification.className = 'field-copy-success';
          document.body.appendChild(notification);
        }
        
        // Set the message and show
        notification.textContent = 'Copied to clipboard!';
        notification.classList.add('show');
        
        // Hide after delay
        setTimeout(() => {
          notification.classList.remove('show');
        }, 2000);
        
        // Completely remove notification after animation completes
        setTimeout(() => {
          notification.style.display = 'none';
          setTimeout(() => {
            notification.style.display = '';
          }, 100);
        }, 2300);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }

  // Toggle verification metadata display
  function toggleVerificationMetadata(event) {
    event.stopPropagation();
    
    const metadata = document.getElementById('verification-metadata');
    const btn = event.currentTarget;
    const btnText = btn.querySelector('.toggle-text');
    
    if (metadata.classList.contains('visible')) {
      // Hide metadata with animation
      metadata.classList.remove('visible');
      setTimeout(() => {
        metadata.style.display = 'none';
      }, 300); // Match transition duration
      
      btnText.textContent = 'Show details';
      btn.classList.remove('expanded');
    } else {
      // Show metadata with animation
      metadata.style.display = 'block';
      
      // Use a small delay to ensure display:block has been applied
      setTimeout(() => {
        metadata.classList.add('visible');
      }, 10);
      
      btnText.textContent = 'Hide details';
      btn.classList.add('expanded');
    }
  }

  // Run verification on page load
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await verifyContent();
    } catch (error) {
      console.error('Verification error:', error);
      updateBadgeStatus(false, "Error during verification: " + error.message);
    }
  });

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
        
        // Hide after delay
        setTimeout(() => {
          successElem.classList.remove('show');
        }, 2000);
        
        // Completely remove notification after animation completes
        setTimeout(() => {
          successElem.style.display = 'none';
          setTimeout(() => {
            successElem.style.display = '';
          }, 100);
        }, 2300);
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
    <div class="verification-badge">
      <button class="toggle-btn" onclick="toggleVerificationMetadata(event)">
        <span class="toggle-text">Show details</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div class="verification-header">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Verified Content
      </div>
      <div id="verification-metadata" class="verification-metadata">
        <div onclick="copyToClipboard('${data.url}', event)" class="copyable-field" title="Click to copy URL">
          <strong>URL:</strong> ${data.url}
        </div>
        <div onclick="copyToClipboard('${formattedTimestamp}', event)" class="copyable-field" title="Click to copy timestamp">
          <strong>Timestamp:</strong> ${formattedTimestamp}
        </div>
        <div onclick="copyToClipboard('${data.contentHash}', event)" class="copyable-field" title="Click to copy content hash">
          <strong>Content Hash:</strong> ${data.contentHash}
        </div>
        <div onclick="copyToClipboard('${data.signatureToken}', event)" class="copyable-field" title="Click to copy signature">
          <strong>Signature:</strong> ${data.signatureToken}
        </div>
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