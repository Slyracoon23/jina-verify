"use client";

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-2xl">
        <div className="flex flex-col items-center gap-4 w-full">
          <h1 className="text-2xl font-bold mb-2">Jina Reader Reverse Proxy</h1>
          <p className="text-center mb-4 text-sm">
            Enter a URL to generate a reverse proxy link that fetches content directly through Jina Reader.
          </p>
          
          <div className="w-full">
            <JinaProxyForm />
          </div>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row mt-8">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://jina.ai/reader/#faq"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more about Jina Reader
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://jina.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Visit Jina AI
        </a>
      </footer>
    </div>
  );
}

function JinaProxyForm() {
  const [url, setUrl] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate URL
    try {
      // Just validate the URL without storing the result
      new URL(url);
      
      // Generate a Jina-style URL format where we add the URL directly to the path
      // This will make it look like Jina's format (r.jina.ai/https://example.com)
      // rather than using query parameters
      const fullProxyUrl = `${window.location.origin}/proxy/${url}`;
      
      setProxyUrl(fullProxyUrl);
    } catch {
      alert("Please enter a valid URL including http:// or https://");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(proxyUrl)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <div className="flex flex-col w-full">
          <label htmlFor="url-input" className="mb-2 text-sm font-medium">
            Enter URL:
          </label>
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="p-3 border border-solid border-black/[.08] dark:border-white/[.145] rounded-md focus:outline-none focus:ring-2 focus:ring-foreground/50 bg-transparent w-full font-[family-name:var(--font-geist-mono)]"
            required
          />
        </div>
        
        <button
          type="submit"
          className="rounded-md border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full"
        >
          Generate Proxy URL
        </button>
      </form>

      {proxyUrl && (
        <div className="mt-6 p-4 border border-solid border-black/[.08] dark:border-white/[.145] rounded-md bg-black/[.03] dark:bg-white/[.03]">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">Your Proxy URL:</p>
            <button
              onClick={copyToClipboard}
              className="text-xs py-1 px-2 rounded-md bg-foreground/10 hover:bg-foreground/20 transition-colors"
            >
              {isCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <p className="text-sm break-all font-[family-name:var(--font-geist-mono)] text-gray-600 dark:text-gray-400 mb-2">
              This URL will serve content from Jina Reader directly through your proxy
            </p>
            <a
              href={proxyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm break-all font-[family-name:var(--font-geist-mono)] text-blue-600 dark:text-blue-400 hover:underline"
            >
              {proxyUrl}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
