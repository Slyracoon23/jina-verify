/**
 * Fetches content from Jina Reader for a given URL.
 * Handles error cases and returns appropriate response data.
 */
export async function fetchFromJinaReader(targetUrl: string): Promise<{
  content: string;
  contentType: string;
  status: number;
  statusText?: string;
}> {
  try {
    const jinaReaderUrl = `https://r.jina.ai/${targetUrl}`;
    const response = await fetch(jinaReaderUrl);
    
    if (!response.ok) {
      return {
        content: '',
        contentType: 'application/json',
        status: response.status,
        statusText: response.statusText
      };
    }
    
    const contentType = response.headers.get('content-type') || 'text/markdown';
    const content = await response.text();
    
    return {
      content,
      contentType,
      status: response.status
    };
  } catch (error) {
    console.error('Error fetching from Jina Reader:', error);
    return {
      content: '',
      contentType: 'application/json',
      status: 500,
      statusText: error instanceof Error ? error.message : String(error)
    };
  }
} 