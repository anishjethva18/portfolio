import React, { useState, useEffect, useRef } from 'react';
import { useOS } from '../../../context/OSContext';
import {
  ExternalLink,
  RefreshCw,
  Globe,
  Lock,
  Zap,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface WebContentViewProps {
  url: string;
  title: string;
  onNavigate?: (url: string) => void;
}

export const WebContentView: React.FC<WebContentViewProps> = ({ url, title, onNavigate }) => {
  const { settings } = useOS();
  const isLightMode = settings?.theme === 'light';

  const [explicitError, setExplicitError] = useState<{
    hasError: boolean;
    message: string;
    targetUrl: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const previousUrlRef = useRef(url);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Parse domain
  let domain = '';
  let cleanUrl = url;
  try {
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    const u = new URL(cleanUrl);
    domain = u.hostname;
  } catch {
    domain = url;
  }

  // Reset error ONLY if the URL actually changes from user navigation
  useEffect(() => {
    if (previousUrlRef.current !== url) {
      previousUrlRef.current = url;
      setExplicitError(null);
      setIsRefreshing(false);
    }
  }, [url]);

  // Hook to handle incoming navigation & proxy error messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        !useProxy ||
        event.origin !== 'null' ||
        event.source !== frameRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object'
      ) return;
      if (event.data.type === 'BROWSER_NAVIGATE') {
        const targetUrl = event.data.url;
        if (typeof targetUrl === 'string' && targetUrl.length <= 2048 && onNavigate) {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(targetUrl);
          } catch {
            return;
          }
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return;
          setExplicitError(null);
          onNavigate(parsedUrl.href);
        }
      } else if (event.data.type === 'BROWSER_PROXY_ERROR') {
        setExplicitError({
          hasError: true,
          message: typeof event.data.error === 'string'
            ? event.data.error.slice(0, 512)
            : 'The web proxy was unable to connect to the remote host.',
          targetUrl: typeof event.data.url === 'string' ? event.data.url.slice(0, 2048) : cleanUrl,
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNavigate, cleanUrl, useProxy]);

  const proxyUrl = `/api/browse/proxy?url=${encodeURIComponent(cleanUrl)}`;
  const activeFrameSrc = useProxy ? proxyUrl : cleanUrl;

  // Explicit user action: Refresh/Reload
  const handleExplicitReload = () => {
    setIsRefreshing(true);
    setExplicitError(null);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Explicit user action: Retry Proxy
  const handleRetryProxy = () => {
    setUseProxy(true);
    setExplicitError(null);
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Explicit user action: Try Direct Connection
  const handleTryDirect = () => {
    setUseProxy(false);
    setExplicitError(null);
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const isShowingError = Boolean(explicitError?.hasError);

  return (
    <div className={`flex flex-col h-full w-full select-text overflow-hidden font-sans ${
      isLightMode ? 'bg-slate-100 text-slate-800' : 'bg-slate-900 text-slate-100'
    }`}>
      {/* Gateway & Quick Action Bar */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 z-10 shadow-xs ${
        isLightMode
          ? 'bg-white border-slate-200 text-slate-700'
          : 'bg-slate-800 border-white/10 text-slate-200'
      }`}>
        <div className="flex items-center gap-2 truncate mr-3">
          <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-medium bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[11px]">
            <Lock className="w-3 h-3" />
            <span className="font-semibold">{domain}</span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate hidden sm:inline">
            {useProxy ? 'Connected via Live Edge Proxy' : 'Direct connection'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setUseProxy(!useProxy);
              setExplicitError(null);
              setIsRefreshing(true);
              setTimeout(() => setIsRefreshing(false), 300);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              useProxy
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
            }`}
            title="Toggle between Direct connection and Web Proxy"
          >
            <Zap className="w-3 h-3" />
            <span>{useProxy ? 'Proxy Active' : 'Direct Active'}</span>
          </button>

          <button
            onClick={handleExplicitReload}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              isLightMode
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
            title="Reload frame"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          <a
            href={cleanUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow cursor-pointer text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Original Site (New Tab)</span>
          </a>
        </div>
      </div>

      {/* Main Web Page Content via Live Proxy */}
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950">
        {!isShowingError && !isRefreshing ? (
          <iframe
            ref={frameRef}
            key={`${activeFrameSrc}-${useProxy}`}
            src={activeFrameSrc}
            title={title || domain}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            onError={() => {
              setExplicitError({
                hasError: true,
                message: 'Security protocols or network restrictions prevented loading inside the inline frame.',
                targetUrl: cleanUrl,
              });
            }}
          />
        ) : (
          /* Persistent Fallback Web Reader & Gateway - Stays visible until explicit user action */
          <div className={`flex flex-col items-center justify-center h-full p-8 text-center space-y-4 select-none ${
            isLightMode ? 'bg-slate-50 text-slate-800' : 'bg-slate-900 text-white'
          }`}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h2 className={`text-base font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                Proxy Connection Notice
              </h2>
              <p className={`text-xs leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                {explicitError?.message || (
                  <>
                    Security protocols on <code className="text-blue-600 dark:text-blue-300 font-mono font-medium">{domain}</code> restrict inline rendering. Open the page directly or search with Google.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRetryProxy}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Retry with Web Proxy</span>
              </button>

              <button
                onClick={handleTryDirect}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  isLightMode
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span>Try Direct Site</span>
              </button>

              <a
                href={cleanUrl}
                target="_blank"
                rel="noreferrer"
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isLightMode
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                <span>Open in New Tab</span>
              </a>

              {onNavigate && (
                <button
                  onClick={() => {
                    setExplicitError(null);
                    onNavigate(`https://google.com/search?q=${encodeURIComponent(title || domain)}`);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isLightMode
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <span>Search on Google</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
