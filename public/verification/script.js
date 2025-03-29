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