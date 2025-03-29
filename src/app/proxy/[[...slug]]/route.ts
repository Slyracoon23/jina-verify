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

  // Check if request is from a browser
  const isFromBrowser = isBrowserRequest(request);
  
  // Check if we should display the verification UI (only applies to browser requests)
  const shouldShowVerificationUI = isFromBrowser && 
    (request.nextUrl.searchParams.has('signature') || !request.nextUrl.searchParams.has('raw'));
  
  const targetUrl = normalizeUrl(slug);

  try {
    // Validate URL format
    new URL(targetUrl);

    const fetchTimestamp = Date.now();
    
    // Fetch content from Jina Reader
    const { content, contentType, status, statusText } = await fetchFromJinaReader(targetUrl);
    
    // If fetch failed, return error
    if (status !== 200) {
      return NextResponse.json(
        { error: `Failed to fetch: ${status} ${statusText}` },
        { status }
      );
    }

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

    // Standard response headers used in all responses
    const commonHeaders = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      'X-Proxy-By': 'Jina-Style-Proxy',
      'X-Signature-Webhook': signatureWebhook,
      'X-Signature-Token': signatureToken,
      'X-Public-Key': PUBLIC_KEY,
    };

    // For non-browser requests (curl, etc.), return raw content with verification in headers
    if (!isFromBrowser || request.nextUrl.searchParams.has('raw')) {
      return new NextResponse(content, { headers: commonHeaders });
    }
    
    // For browser requests, process content according to its type
    let processedContent;
    let finalContentType = contentType;
    
    if (contentType.includes('text/html')) {
      // If HTML, inject our verification UI
      processedContent = injectVerificationUI(content, signatureWebhook, shouldShowVerificationUI);
    } else {
      // Otherwise, wrap the content in our HTML template
      processedContent = wrapContentWithSignatureViewer(content, signatureWebhook);
      finalContentType = 'text/html'; // override to HTML for the wrapper
    }

    return new NextResponse(processedContent, {
      headers: {
        ...commonHeaders,
        'Content-Type': finalContentType,
      }
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