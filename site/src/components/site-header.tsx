"use client";

import Link from "next/link";
import {
  Sparkles,
  Star,
  BookOpen,
  History,
  Home,
} from "lucide-react";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [stars, setStars] = useState<number | null>(null);
  const [version, setVersion] = useState("0.0.2");

  useEffect(() => {
    fetch("https://api.multiwebllm.io/v1/version")
      .then((r) => r.json())
      .then((data) => {
        if (data.stars !== undefined) setStars(data.stars);
        if (data.latest) setVersion(data.latest);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-gray-900"
        >
          <Sparkles className="h-5 w-5 text-blue-600" />
          <span>MultiWebLLM</span>
          <span className="ml-0.5 border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 leading-none">
            v{version}
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            首页
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            文档
          </Link>
          <Link
            href="/changelog"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <History className="h-4 w-4" />
            更新日志
          </Link>
          <a
            href="https://github.com/gentpan/multiwebllm"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
            {stars !== null && (
              <span className="flex items-center gap-0.5 border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 leading-none">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {stars}
              </span>
            )}
          </a>

          <div className="ml-2 h-5 w-px bg-gray-200" />

          <Link
            href="/docs/getting-started"
            className="ml-2 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            开始使用
          </Link>
        </nav>
      </div>
    </header>
  );
}
