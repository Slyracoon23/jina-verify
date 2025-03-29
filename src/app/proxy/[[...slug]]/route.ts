import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  context: { params: { slug?: string[] } }
) {
  // We need to properly await the params before using them
  const params = await context.params;
  
  // Get the complete URL path including all segments after /proxy/
  // The slug param contains all segments as an array
  // For example, for /proxy/https://example.com/path, slug would be ['https:', '', 'example.com', 'path']
  const slugArray = params.slug || [];
  
  // Reconstruct the full target URL from the slug array
  let targetUrl: string;
  
  // Handle case when URL is directly after /proxy/
  if (slugArray.length > 0) {
    // Join all parts of the slug array back together
    // For example: ['https:', '', 'example.com', 'path'] => 'https://example.com/path'
    targetUrl = slugArray.join('/');
    
    // Sometimes the protocol separator gets split incorrectly, so we need to fix it
    if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
      targetUrl = targetUrl.replace('https:/', 'https://');
    }
    
    if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
      targetUrl = targetUrl.replace('http:/', 'http://');
    }
  } else {
    return NextResponse.json({ error: 'URL is required in the path (e.g., /proxy/https://example.com)' }, { status: 400 });
  }

  try {
    // Validate the URL
    new URL(targetUrl);
    
    // Construct the Jina Reader URL
    const jinaReaderUrl = `https://r.jina.ai/${targetUrl}`;
    
    // Act as a true reverse proxy - fetch content from Jina Reader
    const response = await fetch(jinaReaderUrl);
    
    // Check if the fetch was successful
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch from Jina Reader: ${response.status} ${response.statusText}` 
      }, { status: response.status });
    }
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'text/markdown';
    
    // Get the content from the response
    const content = await response.text();
    
    // Return the content directly to the client with appropriate headers
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'X-Proxy-By': 'Jina-Style-Proxy'
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to proxy the content',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 