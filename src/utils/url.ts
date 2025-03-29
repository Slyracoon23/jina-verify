import { NextRequest } from 'next/server';

/**
 * Normalizes the URL from slug parts (ensures proper protocol).
 */
export function normalizeUrl(slugParts: string[]): string {
  const url = slugParts.join('/');
  return url
    .replace(/^https:\/(?!\/)/, 'https://')
    .replace(/^http:\/(?!\/)/, 'http://');
}

/**
 * Checks if the request is from a browser based on User-Agent.
 */
export function isBrowserRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  
  // Check for common browser identifiers
  return userAgent.includes('Mozilla/') || 
         userAgent.includes('Chrome/') || 
         userAgent.includes('Safari/') || 
         userAgent.includes('Edge/') || 
         userAgent.includes('Firefox/');
} 