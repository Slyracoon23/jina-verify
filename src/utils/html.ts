import path from 'path';
import fs from 'fs';

// Load HTML templates from public folder
const TEMPLATE_DIR = path.join(process.cwd(), 'public', 'verification', 'templates');
const BADGE_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'badge.html'), 'utf-8');
const COPY_BUTTON_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'copy-button.html'), 'utf-8');
const WRAPPER_TEMPLATE = fs.readFileSync(path.join(TEMPLATE_DIR, 'wrapper.html'), 'utf-8');

// Define public asset paths
const VERIFICATION_CSS_PATH = '/verification/styles.css';
const VERIFICATION_JS_PATH = '/verification/script.js';

export interface VerificationData {
  url: string;
  timestamp: number;
  contentHash: string;
  signatureToken: string;
  publicKey: string;
}

/**
 * Safely escapes HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Creates the verification badge HTML from the template.
 */
export function createVerificationBadge(data: VerificationData): string {
  const formattedTimestamp = new Date(data.timestamp).toLocaleString();
  
  return BADGE_TEMPLATE
    .replace(/\$\{url\}/g, data.url)
    .replace(/\$\{timestamp\}/g, formattedTimestamp)
    .replace(/\$\{contentHash\}/g, data.contentHash)
    .replace(/\$\{signatureToken\}/g, data.signatureToken)
    .replace(/\$\{publicKey\}/g, data.publicKey);
}

/**
 * Injects verification UI into HTML content (badge + copy button + style + meta).
 */
export function injectVerificationUI(
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
export function wrapContentWithSignatureViewer(content: string, signatureWebhook: string): string {
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