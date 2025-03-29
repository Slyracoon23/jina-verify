import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
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
    
    // Redirect to Jina Reader
    return NextResponse.redirect(jinaReaderUrl);
    
    // Alternative: Fetch and return content
    // const response = await fetch(jinaReaderUrl);
    // const data = await response.text();
    // return new NextResponse(data, {
    //   headers: {
    //     'Content-Type': 'text/markdown',
    //   },
    // });
  } catch {
    return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
  }
} 