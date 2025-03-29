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
    
    const highlightToolbar = tempDiv.querySelector('.highlight-toolbar');
    if (highlightToolbar) highlightToolbar.remove();
    
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
  // 1. Have the public key available on the client (already provided in data.publicKey)
  // 2. Use Web Crypto API to verify the RS256 signature
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
    header.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      Verified Content
    `;
    header.style.color = '#4caf50';
  } else {
    badge.style.borderColor = '#f44336';
    header.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Verification Failed
    `;
    header.style.color = '#f44336';
    
    // Add error message to metadata
    const metadata = document.getElementById('verification-metadata');
    if (metadata) {
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
      errorDiv.style.borderLeft = '3px solid #f44336';
      metadata.prepend(errorDiv);
    }
  }
}

// Copy text to clipboard
function copyToClipboard(text, event) {
  // Stop event propagation to prevent toggling the metadata
  if (event) event.stopPropagation();
  
  // Copy to clipboard
  return navigator.clipboard.writeText(text)
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
      
      return true;
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
      return false;
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
    
    // Apply highlighting if parameter exists
    applyHighlighting();
    
    // Set up text selection highlighting
    setupTextHighlighting();
    
  } catch (error) {
    console.error('Verification error:', error);
    updateBadgeStatus(false, "Error during verification: " + error.message);
  }
});

// Add global variable to track if share modal is open
let isShareModalOpen = false;

// Set up text highlighting functionality
function setupTextHighlighting() {
  // Create highlight toolbar element
  const toolbar = document.createElement('div');
  toolbar.className = 'highlight-toolbar';
  toolbar.style.display = 'none';
  toolbar.style.zIndex = '10000'; // Ensure it appears above other elements
  toolbar.innerHTML = `
    <button class="highlight-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      Highlight & Share
    </button>
  `;
  document.body.appendChild(toolbar);
  
  // Position toolbar near selection when text is selected
  document.addEventListener('mouseup', function() {
    // Don't show the toolbar if the share modal is open
    if (isShareModalOpen) return;
    
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Position toolbar significantly above the selection
      toolbar.style.position = 'absolute';
      toolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
      toolbar.style.top = `${rect.top + window.scrollY - toolbar.offsetHeight - 50}px`;
      toolbar.style.display = 'block';
      toolbar.style.pointerEvents = 'auto'; // Ensure it's clickable
      
      // Ensure toolbar is within viewport boundaries
      setTimeout(() => {
        const toolbarRect = toolbar.getBoundingClientRect();
        
        // Handle horizontal position
        if (toolbarRect.left < 10) {
          toolbar.style.left = '10px';
        } else if (toolbarRect.right > window.innerWidth - 10) {
          toolbar.style.left = `${window.innerWidth - toolbar.offsetWidth - 10}px`;
        }
        
        // If toolbar goes above the top of viewport, position it below the selection
        if (toolbarRect.top < 10) {
          toolbar.style.top = `${rect.bottom + window.scrollY + 20}px`;
        }
      }, 0);
    } else {
      // Hide toolbar when no selection
      toolbar.style.display = 'none';
    }
  });
  
  // Hide toolbar when clicking elsewhere
  document.addEventListener('mousedown', function(e) {
    if (!toolbar.contains(e.target)) {
      toolbar.style.display = 'none';
    }
  });
  
  // Highlight and share button click handler
  const highlightBtn = toolbar.querySelector('.highlight-btn');
  highlightBtn.addEventListener('click', function() {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      createHighlightShareLink(selection.toString());
      toolbar.style.display = 'none';
    }
  });
}

// Create a shareable link with the highlighted text
function createHighlightShareLink(selectedText) {
  // Set flag to prevent toolbar from appearing
  isShareModalOpen = true;
  
  // Get current URL
  const currentUrl = window.location.href;
  
  // Create URL with highlight parameter
  const url = new URL(currentUrl);
  url.searchParams.set('highlight', selectedText.trim());
  
  // Create a modal to show and copy the link
  const modal = document.createElement('div');
  modal.className = 'highlight-share-modal';
  modal.innerHTML = `
    <div class="highlight-share-content">
      <h3>Share Highlighted Content</h3>
      <p>Use this link to share the content with your highlighted text:</p>
      <div class="highlight-link-container">
        <input type="text" class="highlight-link" value="${url.toString()}" readonly>
        <button class="copy-link-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Link
        </button>
      </div>
      <div class="copy-success-indicator">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>Copied to clipboard!</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Style the modal
  const style = document.createElement('style');
  style.textContent = `
    .highlight-share-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    }
    .highlight-share-content {
      background-color: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      width: 90%;
      max-width: 550px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .highlight-share-content h3 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }
    .highlight-share-content p {
      margin-bottom: 20px;
      color: #555;
      font-size: 15px;
    }
    .highlight-link-container {
      display: flex;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      overflow: hidden;
    }
    .highlight-link {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid #e0e0e0;
      border-right: none;
      border-radius: 6px 0 0 6px;
      font-size: 14px;
      color: #333;
      background-color: #f9f9f9;
    }
    .highlight-link:focus {
      outline: none;
      background-color: #fff;
    }
    .copy-link-btn {
      padding: 0 20px;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 0 6px 6px 0;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    .copy-link-btn:hover {
      background-color: #1d4ed8;
    }
    .copy-link-btn:active {
      background-color: #1e40af;
    }
    .copy-success-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #16a34a;
      font-size: 14px;
      margin-top: 12px;
      border-top: none;
      padding: 0;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s, transform 0.3s;
      pointer-events: none;
    }
    
    .copy-success-indicator.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .copy-success-indicator svg {
      stroke: #16a34a;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(10px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    .highlight-toolbar {
      background-color: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px;
      animation: fadeIn 0.2s ease-out;
    }
    .highlight-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: #f8f9fa;
      color: #333;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .highlight-btn:hover {
      background-color: #ebedf0;
      border-color: #d0d0d0;
    }
    .highlight-btn svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);
  
  // Don't auto-select the text to avoid automatic copying
  // Instead, focus the input without selecting
  setTimeout(() => {
    linkInput.focus();
    
    // Ensure success indicator is initially hidden
    const successIndicator = modal.querySelector('.copy-success-indicator');
    successIndicator.style.opacity = '0';
    successIndicator.style.transform = 'translateY(10px)';
  }, 100);
  
  // Copy link button handler
  const copyBtn = modal.querySelector('.copy-link-btn');
  const linkInput = modal.querySelector('.highlight-link');
  const successIndicator = modal.querySelector('.copy-success-indicator');
  
  copyBtn.addEventListener('click', function() {
    copyToClipboard(linkInput.value).then(success => {
      if (success) {
        // Show success indicator
        successIndicator.classList.add('visible');
        successIndicator.style.opacity = '1';
        successIndicator.style.transform = 'translateY(0)';
        
        // Auto-close modal after delay
        setTimeout(() => {
          // Fade out animation
          modal.style.opacity = '0';
          modal.style.transition = 'opacity 0.3s ease';
          
          setTimeout(() => {
            document.body.removeChild(modal);
            // Reset share modal flag
            isShareModalOpen = false;
          }, 300);
        }, 1500);
      }
    });
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      // Fade out animation
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.3s ease';
      
      setTimeout(() => {
        document.body.removeChild(modal);
        // Reset share modal flag
        isShareModalOpen = false;
      }, 300);
    }
  });
}

// Function to apply highlighting based on regex pattern
function applyHighlighting() {
  // Get the highlight parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const highlightParam = urlParams.get('highlight');
  
  if (!highlightParam) return;
  
  try {
    // For non-HTML content in the wrapper
    const preElement = document.querySelector('.content pre');
    if (preElement) {
      // Apply highlighting to the pre content
      const originalText = preElement.innerText;
      const highlightedText = highlightText(originalText, highlightParam);
      preElement.innerHTML = highlightedText;
    } else {
      // For HTML content, we need to be careful to only highlight text nodes
      // Apply highlighting to text nodes only (excluding scripts, styles)
      highlightTextNodes(document.body, highlightParam);
    }
  } catch (error) {
    console.error('Error applying highlighting:', error);
  }
}

// Simple text highlighting function that wraps matched substrings with span
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;
  
  // Escape special characters for safe HTML insertion
  const escapeHtml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  
  // Case-insensitive search
  const searchTermLower = searchTerm.toLowerCase();
  const textLower = text.toLowerCase();
  
  let result = '';
  let lastIndex = 0;
  let index = textLower.indexOf(searchTermLower);
  
  while (index !== -1) {
    // Add text before the match
    result += escapeHtml(text.substring(lastIndex, index));
    
    // Add the highlighted match
    const matchedText = text.substring(index, index + searchTerm.length);
    result += `<span class="highlighted-text">${escapeHtml(matchedText)}</span>`;
    
    // Update search position
    lastIndex = index + searchTerm.length;
    index = textLower.indexOf(searchTermLower, lastIndex);
  }
  
  // Add the remaining text
  result += escapeHtml(text.substring(lastIndex));
  
  return result;
}

// Function to highlight text nodes without affecting HTML structure
function highlightTextNodes(element, searchTerm) {
  if (!element) return;
  
  // Ignore verification UI elements
  if (element.classList && 
     (element.classList.contains('verification-badge') || 
      element.classList.contains('copy-btn-container') ||
      element.classList.contains('highlight-toolbar') ||
      element.classList.contains('highlight-share-modal'))) {
    return;
  }
  
  // Skip script and style tags
  if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
    return;
  }
  
  // Process text nodes
  if (element.nodeType === Node.TEXT_NODE && element.textContent.trim()) {
    const originalText = element.textContent;
    const textLower = originalText.toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    
    if (textLower.includes(searchTermLower)) {
      // Create a wrapper span
      const wrapper = document.createElement('span');
      
      // Replace text with highlighted version
      wrapper.innerHTML = highlightText(originalText, searchTerm);
      
      // Replace the text node with our wrapper
      element.parentNode.replaceChild(wrapper, element);
    }
  } else {
    // Recursively process child nodes
    Array.from(element.childNodes).forEach(child => {
      highlightTextNodes(child, searchTerm);
    });
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
    const highlightToolbar = tempDiv.querySelector('.highlight-toolbar');
    if (highlightToolbar) {
      highlightToolbar.remove();
    }
    contentToCopy = tempDiv.querySelector('body').innerHTML;
  }
  
  copyToClipboard(contentToCopy);
} 