import React, { useState, useRef } from 'react';
import { Camera, Upload, Link, X, Sparkles, ExternalLink, Copy } from 'lucide-react';
import { useOS } from '../../../context/OSContext';

interface GoogleLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchQuery: (query: string) => void;
}

export const GoogleLensModal: React.FC<GoogleLensModalProps> = ({
  isOpen,
  onClose,
  onSearchQuery,
}) => {
  const { files } = useOS();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    title: string;
    description: string;
    tags: string[];
    extractedText: string;
    matchingLinks: Array<{ title: string; url: string; snippet: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const sampleImages = [
    {
      id: 'sample-1',
      title: 'Windows 11 Portfolio OS',
      url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop',
      category: 'UI/UX & Operating System',
    },
    {
      id: 'sample-2',
      title: 'Full Stack Code & Architecture',
      url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop',
      category: 'Software Engineering',
    },
    {
      id: 'sample-3',
      title: 'Anish Jethva Developer Portrait',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
      category: 'Developer Profile',
    },
    {
      id: 'sample-4',
      title: 'Modern Workspace & Hardware',
      url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop',
      category: 'Developer Setup',
    },
  ];

  const handleSelectImage = (url: string, titleHint?: string) => {
    setSelectedImage(url);
    setIsAnalyzing(true);
    setAnalysisResult(null);

    setTimeout(() => {
      setIsAnalyzing(false);
      if (titleHint?.includes('Portrait') || url.includes('photo-1534528741775')) {
        setAnalysisResult({
          title: 'Anish Jethva — Full Stack & AI Engineer',
          description: 'Identified software developer profile, specializes in React 18, TypeScript, Node.js, and GenAI applications.',
          tags: ['Software Engineer', 'Full Stack Developer', 'Portfolio', 'TypeScript', 'GenAI'],
          extractedText: 'ANISH JETHVA\nFULL STACK & AI DEVELOPER\nPassionate about building intuitive web systems.',
          matchingLinks: [
            { title: 'Anish Jethva Official Portfolio', url: 'https://anishjethva.dev', snippet: 'Interactive Windows 11 cloud portfolio featuring full stack projects and resume.' },
            { title: 'GitHub Profile — anishjethva18', url: 'https://github.com/anishjethva18', snippet: 'Explore open source repositories, cloud tools, and experimental AI engines.' },
          ],
        });
      } else if (titleHint?.includes('Code') || url.includes('photo-1526374965328')) {
        setAnalysisResult({
          title: 'TypeScript & React Application Architecture',
          description: 'Detected modern web development code with high-performance state management and micro-interactions.',
          tags: ['React 18', 'TypeScript', 'Tailwind CSS', 'Vite', 'Frontend Architecture'],
          extractedText: 'import React from "react";\nconst App = () => {\n  return <WindowsPortfolioOS />;\n};',
          matchingLinks: [
            { title: 'React 18 & Vite Developer Documentation', url: 'https://react.dev', snippet: 'The official library for web and native user interfaces.' },
            { title: 'GitHub Developer Showcase', url: 'https://github.com/anishjethva18', snippet: 'Review source code and architecture diagrams.' },
          ],
        });
      } else {
        setAnalysisResult({
          title: titleHint || 'Visual Match: Windows 11 Desktop System',
          description: 'Identified visual elements matching interactive desktop UI, fluent design patterns, and creative developer portfolios.',
          tags: ['Windows 11', 'Fluent UI', 'Web Desktop', 'Operating System Simulation'],
          extractedText: 'GOOGLE LENS VISUAL SEARCH\nIdentified 12 visually similar developer portfolios and UI assets.',
          matchingLinks: [
            { title: 'Google Search for similar web desktops', url: 'https://google.com/search?q=windows+11+web+portfolio', snippet: 'Find projects, live demos, and web operating systems.' },
            { title: 'Anish Jethva Portfolio Projects', url: 'https://anishjethva.dev', snippet: 'Explore full stack applications, games, and developer utilities.' },
          ],
        });
      }
    }, 1200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleSelectImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          handleSelectImage(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Google Lens
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                  Visual Search
                </span>
              </h2>
              <p className="text-xs text-slate-400">Search any image to find matches, extract text, or identify objects</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!selectedImage ? (
            <>
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-cyan-400/60 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 transition-all cursor-pointer group text-center"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-white/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-transform group-hover:scale-110">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Drag an image here or browse from This PC</div>
                  <div className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WEBP, GIF, SVG, BMP, HEIC</div>
                </div>
              </div>

              {/* Paste URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Or paste an image URL</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Link className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (imageUrlInput.trim()) handleSelectImage(imageUrlInput.trim(), 'Custom Image URL');
                    }}
                    disabled={!imageUrlInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Sample Images Gallery */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">Or try searching with sample images:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sampleImages.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectImage(s.url, s.title)}
                      className="group relative rounded-xl overflow-hidden aspect-video bg-slate-950 border border-white/10 hover:border-cyan-400 cursor-pointer transition-all hover:scale-105"
                    >
                      <img src={s.url} alt={s.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                        <span className="text-[10px] font-bold text-white truncate">{s.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Results View */
            <div className="space-y-6">
              {/* Selected Image Banner */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <img
                  src={selectedImage}
                  alt="Selected search subject"
                  className="w-24 h-24 object-cover rounded-xl border border-white/20 shadow-md shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-400">Search Subject</span>
                    {isAnalyzing && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse font-medium">
                        Analyzing visual patterns...
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 truncate">
                    {analysisResult ? analysisResult.title : 'Processing image with Google Lens...'}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setAnalysisResult(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white underline mt-2 cursor-pointer"
                  >
                    Choose another image
                  </button>
                </div>
              </div>

              {/* Analysis Content */}
              {isAnalyzing ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-300 font-medium">Extracting objects, text & web matches...</span>
                </div>
              ) : analysisResult ? (
                <div className="space-y-5 animate-in fade-in">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.tags.map((t, idx) => (
                      <span
                        key={idx}
                        onClick={() => {
                          onSearchQuery(t);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-400/40 border border-white/10 text-xs text-slate-200 transition-colors cursor-pointer"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Description Box */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 text-xs text-slate-300 leading-relaxed">
                    <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      Visual Insights
                    </div>
                    {analysisResult.description}
                  </div>

                  {/* Extracted Text (OCR) */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Detected Text (OCR)</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(analysisResult.extractedText)}
                        className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        Copy text
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap bg-black/40 p-2.5 rounded-xl border border-white/5">
                      {analysisResult.extractedText}
                    </pre>
                  </div>

                  {/* Matching Web Results */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-white">Visual Matches & Related Sources</h4>
                    <div className="space-y-2">
                      {analysisResult.matchingLinks.map((link, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            onSearchQuery(link.url);
                            onClose();
                          }}
                          className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="overflow-hidden pr-2">
                            <div className="text-xs font-semibold text-cyan-400 group-hover:underline truncate">
                              {link.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">{link.snippet}</div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">Powered by Google Lens visual recognition</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
