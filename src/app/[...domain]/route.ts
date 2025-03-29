import { NextRequest, NextResponse } from 'next/server';
import { hashContent, createSignatureToken } from '@/utils/crypto';
import { 
  VerificationData, 
  injectVerificationUI, 
  wrapContentWithSignatureViewer 
} from '@/utils/html';
import { normalizeUrl, isBrowserRequest } from '@/utils/url';
import { fetchFromJinaReader } from '@/services/jina-reader';

// Use environment variables for the key pair
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'your-private-key-change-me';
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'your-public-key-change-me';

/**
 * GET request handler: reverse proxy to the Jina Reader.
 * Detects browser vs. CLI requests and formats content accordingly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string[] }> }
) {
  const { domain = [] } = await params;

  // Require a URL in the path
  if (domain.length === 0) {
    return NextResponse.json(
      { error: 'URL is required in the path (e.g., /proxy/https://example.com)' },
      { status: 400 }
    );
  }

  const isFromBrowser = isBrowserRequest(request);
  const targetUrl = normalizeUrl(domain);

  try {
    // Validate URL format
    new URL(targetUrl);

    // Fetch and prepare content (common for both flows)
    const result = await fetchAndPrepareContent(targetUrl);
    
    if (result.status !== 200) {
      return NextResponse.json(
        { error: `Failed to fetch: ${result.status} ${result.statusText}` },
        { status: result.status }
      );
    }

    // Choose appropriate handler based on request type
    if (!isFromBrowser || request.nextUrl.searchParams.has('raw')) {
      return handleNonBrowserRequest(result);
    } else {
      return handleBrowserRequest(request, result);
    }
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

// Helper function to fetch and prepare content
async function fetchAndPrepareContent(targetUrl: string) {
  const fetchTimestamp = Date.now();
  
  // Fetch content from Jina Reader
  const { content, contentType, status, statusText } = await fetchFromJinaReader(targetUrl);
  
  // Create verification data
  const contentHash = hashContent(content);
  const signatureToken = createSignatureToken(targetUrl, fetchTimestamp, contentHash, PRIVATE_KEY);
  const verificationData: VerificationData = {
    url: targetUrl,
    timestamp: fetchTimestamp,
    contentHash,
    signatureToken,
    publicKey: PUBLIC_KEY,
  };
  const signatureWebhook = JSON.stringify(verificationData);

  // Standard response headers
  const commonHeaders = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
    'X-Proxy-By': 'Jina-Style-Proxy',
    'X-Signature-Webhook': signatureWebhook,
    'X-Signature-Token': signatureToken,
    'X-Public-Key': PUBLIC_KEY,
  };

  return { 
    content, 
    contentType, 
    status, 
    statusText, 
    signatureWebhook,
    commonHeaders 
  };
}

// Handler for non-browser requests (CLI tools, APIs, etc.)
function handleNonBrowserRequest(result: {
  content: string,
  commonHeaders: Record<string, string>
}) {
  return new NextResponse(result.content, { 
    headers: result.commonHeaders 
  });
}

// Handler for browser requests
function handleBrowserRequest(
  request: NextRequest,
  result: {
    content: string,
    contentType: string,
    signatureWebhook: string,
    commonHeaders: Record<string, string>
  }
) {
  // Check if we should display the verification UI
  const shouldShowVerificationUI = 
    request.nextUrl.searchParams.has('signature') || 
    !request.nextUrl.searchParams.has('raw');
  
  let processedContent;
  let finalContentType = result.contentType;
  
  if (result.contentType.includes('text/html')) {
    // If HTML, inject our verification UI
    processedContent = injectVerificationUI(
      result.content, 
      result.signatureWebhook, 
      shouldShowVerificationUI
    );
  } else {
    // Otherwise, wrap the content in our HTML template
    processedContent = wrapContentWithSignatureViewer(
      result.content, 
      result.signatureWebhook
    );
    finalContentType = 'text/html'; // override to HTML for the wrapper
  }

  return new NextResponse(processedContent, {
    headers: {
      ...result.commonHeaders,
      'Content-Type': finalContentType,
    }
  });
}