"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const code = `git clone https://github.com/gentpan/multiwebllm.git
cd multiwebllm
cp aiproxy/.env.example aiproxy/.env
docker compose up -d
docker compose --profile init run --rm multiwebllm-init`;

export function CopyTerminal() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-10 overflow-hidden border border-gray-200 bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 bg-red-500"></span>
          <span className="h-3 w-3 bg-yellow-500"></span>
          <span className="h-3 w-3 bg-green-500"></span>
          <span className="ml-4 text-xs text-gray-400">Terminal</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="p-6 text-sm leading-7 text-green-400 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
