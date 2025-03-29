import { NextRequest, NextResponse } from 'next/server';


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate URL
    new URL(targetUrl);

    // In a real implementation, we'd fetch the content from Jina Reader here
    // This is the URL we'd construct to access Jina Reader
    const jinaReaderUrl = `https://r.jina.ai/${targetUrl}`;

    // For demonstration purposes, we'll redirect to the Jina Reader URL
    // In a production implementation, you might want to:
    // 1. Fetch the content from Jina Reader
    // 2. Process or modify it as needed
    // 3. Return it to the client
    
    // Option 1: Redirect to Jina Reader
    return NextResponse.redirect(jinaReaderUrl);
    
    // Option 2: Fetch and return content (commented out, would require implementation)
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