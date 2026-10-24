import React, { useEffect, useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';

export const Wallpaper: React.FC = () => {
  const { settings, files } = useOS();
  const { wallpaper, customWallpaperUrl, theme } = settings;
  const [loadError, setLoadError] = useState(false);

  // Resolve custom wallpaper if it's a file path
  const resolvedUrl = React.useMemo(() => {
    if (!customWallpaperUrl) return '';
    const matchingFile = files.find(
      (f) => f.path === customWallpaperUrl || f.id === customWallpaperUrl || f.name === customWallpaperUrl
    );
    return matchingFile?.content || customWallpaperUrl;
  }, [customWallpaperUrl, files]);

  useEffect(() => {
    setLoadError(false);
  }, [resolvedUrl, wallpaper]);

  if (wallpaper === 'custom' && resolvedUrl && !loadError) {
    // 1. YouTube video detection (watch, share, embed, shorts)
    const ytMatch = resolvedUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    if (ytMatch && ytMatch[1]) {
      const ytId = ytMatch[1];
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&autohide=1&modestbranding=1&enablejsapi=1&iv_load_policy=3`}
            allow="autoplay; encrypted-media"
            title="YouTube Live Wallpaper"
            onError={() => setLoadError(true)}
            className="absolute -top-[15%] -left-[15%] w-[130%] h-[130%] object-cover pointer-events-none border-0 select-none"
          />
        </div>
      );
    }

    // 2. Direct Video File detection (.mp4, .webm, data:video, blob:)
    const isVideo =
      (resolvedUrl.endsWith('.mp4') ||
        resolvedUrl.endsWith('.webm') ||
        resolvedUrl.includes('.mp4?') ||
        resolvedUrl.includes('.webm?') ||
        resolvedUrl.startsWith('data:video/mp4') ||
        resolvedUrl.startsWith('data:video/webm') ||
        resolvedUrl.startsWith('blob:') ||
        resolvedUrl.includes('/sample/')) &&
      !resolvedUrl.includes('unsplash.com') &&
      !resolvedUrl.startsWith('C:/');

    if (isVideo) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-slate-950">
          <video
            autoPlay
            loop
            muted
            playsInline
            key={resolvedUrl}
            src={resolvedUrl}
            onError={(e) => {
              e.stopPropagation();
              setLoadError(true);
            }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-700 select-none"
          />
        </div>
      );
    }

    // 3. WebGL / Interactive URL / Live website
    const isLiveWebPage =
      (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) &&
      !/\.(jpg|jpeg|png|webp|avif|gif|svg|bmp|ico)(\?.*)?$/i.test(resolvedUrl) &&
      !resolvedUrl.includes('unsplash.com') &&
      !resolvedUrl.includes('wallpapershome') &&
      !resolvedUrl.includes('image') &&
      !resolvedUrl.includes('photo');

    if (isLiveWebPage) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-slate-950">
          <iframe
            src={resolvedUrl}
            title="Live Interactive Wallpaper"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onError={() => setLoadError(true)}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none select-none transition-all duration-700"
          />
        </div>
      );
    }

    // 4. Image wallpaper with fallback handler and anti-hotlink bypass
    const fitClass =
      settings.wallpaperFit === 'fit'
        ? 'object-contain'
        : settings.wallpaperFit === 'stretch'
        ? 'object-fill'
        : settings.wallpaperFit === 'center'
        ? 'object-none'
        : 'object-cover';

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-slate-950">
        <img
          src={resolvedUrl}
          alt="Desktop Wallpaper"
          referrerPolicy="no-referrer"
          onError={() => setLoadError(true)}
          className={`absolute inset-0 w-full h-full ${fitClass} pointer-events-none transition-all duration-700 select-none`}
        />
      </div>
    );
  }

  switch (wallpaper) {
    case 'live-matrix':
      return <LiveMatrixWallpaper />;

    case 'live-waves':
      return <LiveWavesWallpaper />;

    case 'live-cyberpunk':
      return <LiveCyberpunkWallpaper />;

    case 'live-aurora':
      return <LiveAuroraWallpaper />;

    case 'aurora':
      return (
        <div className="absolute inset-0 bg-[#070b19] transition-all duration-700 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 left-10 w-[800px] h-[400px] bg-gradient-to-r from-emerald-500/30 via-teal-400/20 to-cyan-500/30 blur-[120px] transform -rotate-12" />
          <div className="absolute top-1/2 right-0 w-[600px] h-[500px] bg-gradient-to-l from-purple-600/30 via-pink-500/20 to-transparent blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 w-[700px] h-[300px] bg-gradient-to-t from-blue-600/30 to-teal-500/20 blur-[100px]" />
        </div>
      );

    case 'cyberpunk':
      return (
        <div className="absolute inset-0 bg-[#0a0612] transition-all duration-700 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-fuchsia-600/35 to-rose-600/20 blur-3xl" />
          <div className="absolute bottom-10 -left-20 w-[700px] h-[500px] bg-gradient-to-tr from-cyan-600/35 via-blue-600/20 to-purple-800/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        </div>
      );

    case 'sunset':
      return (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 transition-all duration-700 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-amber-500/25 via-rose-500/20 to-purple-600/15 blur-3xl" />
          <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-slate-950 to-transparent" />
        </div>
      );

    case 'minimal':
      return (
        <div className="absolute inset-0 bg-[#121316] transition-all duration-700 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[140px]" />
        </div>
      );

    case 'darkbloom':
    case 'bloom':
    default:
      if (theme === 'light' && wallpaper === 'bloom') {
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 transition-all duration-700 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-blue-600/35 via-sky-400/25 to-indigo-500/20 blur-[110px]" />
            <div className="absolute top-1/2 right-10 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-cyan-500/30 via-blue-500/20 to-purple-600/20 blur-[120px]" />
            <div className="absolute bottom-10 left-1/4 w-[800px] h-[400px] rounded-full bg-gradient-to-t from-sky-600/20 to-indigo-600/10 blur-[130px]" />
          </div>
        );
      }

      // Windows 11 Official Dark Bloom Wallpaper (Image 2)
      return (
        <div className="absolute inset-0 bg-[#070b14] transition-all duration-700 overflow-hidden pointer-events-none select-none z-0">
          {/* Ambient Lighting Layers */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[750px] rounded-full bg-gradient-to-tr from-blue-600/40 via-sky-500/30 to-indigo-600/30 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[500px] rounded-full bg-blue-900/30 blur-[120px]" />
          
          {/* High-res Windows 11 Dark Bloom 3D Artwork */}
          <img
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=2560&auto=format&fit=crop&q=90"
            alt="Windows 11 Dark Bloom Wallpaper"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none opacity-90 transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>
      );
  }
};

// 1. Live Matrix Digital Rain Wallpaper
const LiveMatrixWallpaper: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '0123456789ABCDEF<>/*+-~#$';
    const fontSize = 14;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 12, 10, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#10b981';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 40);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

// 2. Live Flowing Waves Wallpaper
const LiveWavesWallpaper: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const draw = () => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      step += 0.015;

      const lines = [
        { color: 'rgba(59, 130, 246, 0.4)', amplitude: 45, speed: 1.0, offset: 0 },
        { color: 'rgba(14, 165, 233, 0.35)', amplitude: 60, speed: 0.8, offset: 2 },
        { color: 'rgba(99, 102, 241, 0.3)', amplitude: 50, speed: 1.2, offset: 4 },
      ];

      lines.forEach((line) => {
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = line.color;

        for (let x = 0; x <= canvas.width; x += 10) {
          const y =
            canvas.height / 2 +
            Math.sin(x * 0.005 + step * line.speed + line.offset) * line.amplitude +
            Math.cos(x * 0.003 + step * 0.5) * 20;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

// 3. Live Cyberpunk Synthwave Grid Wallpaper
const LiveCyberpunkWallpaper: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-[#0a0518] overflow-hidden pointer-events-none z-0">
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-t from-rose-500/40 via-fuchsia-600/30 to-transparent blur-2xl animate-pulse" />
      <div
        className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#d946ef22_1px,transparent_1px),linear-gradient(to_bottom,#06b6d422_1px,transparent_1px)] bg-[size:3rem_3rem]"
        style={{
          perspective: '600px',
          transform: 'rotateX(55deg) translateY(-20%)',
          transformOrigin: '50% 100%',
        }}
      />
    </div>
  );
};

// 4. Live Breathing Aurora Wallpaper
const LiveAuroraWallpaper: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-[#050c1e] overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-32 left-0 w-[900px] h-[600px] rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-400/20 to-cyan-500/25 blur-[120px] animate-pulse duration-[8000ms]" />
      <div className="absolute top-1/2 -right-20 w-[800px] h-[600px] rounded-full bg-gradient-to-l from-purple-600/25 via-pink-500/20 to-blue-600/20 blur-[130px] animate-pulse duration-[10000ms]" />
    </div>
  );
};
