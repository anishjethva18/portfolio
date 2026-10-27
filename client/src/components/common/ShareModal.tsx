import React, { useState, useEffect } from 'react';
import { FileItem } from '../../types';
import { useOS } from '../../context/OSContext';
import { soundManager } from '../../utils/sound';
import {
  X,
  Share2,
  Copy,
  Check,
  Mail,
  MessageSquare,
  Globe,
  FileText,
  Film,
  Folder,
} from 'lucide-react';

interface ShareModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, isOpen, onClose }) => {
  const { addNotification, openApp } = useOS();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      soundManager.playShare();
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const isFolder = file.type === 'folder';
  const ext = (file.extension || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  const isVideo = ['mp4', 'webm', 'mov', 'ogg'].includes(ext);

  const handleCopyPath = () => {
    const formatted = file.path.replace(/\//g, '\\');
    navigator.clipboard.writeText(formatted);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addNotification({
      title: 'Path Copied',
      message: `Copied "${file.name}" path to clipboard`,
      type: 'info',
    });
  };

  const handleCopyContent = () => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
      addNotification({
        title: 'Content Copied',
        message: `Copied contents of "${file.name}" to clipboard`,
        type: 'success',
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.name,
          text: `Check out ${file.name} on Windows 11 Portfolio`,
          url: window.location.href,
        });
        addNotification({
          title: 'Shared Successfully',
          message: `Shared "${file.name}" via native share`,
          type: 'success',
        });
        onClose();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyPath();
        }
      }
    } else {
      handleCopyPath();
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Shared File: ${file.name}`);
    const body = encodeURIComponent(
      `Hello,\n\nSharing the file "${file.name}" (${file.size || '1 KB'}) located at ${file.path}.\n\nPortfolio Link: ${window.location.href}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    onClose();
  };

  const handleSendToContact = () => {
    openApp('contact', {
      subject: `File Attachment: ${file.name}`,
      message: `Hello Anish,\n\nI'm sharing the attached file "${file.name}" with you.`,
      attachments: [
        {
          name: file.name,
          path: file.path,
          size: file.size || '1 KB',
          type: file.type || 'file',
          content: file.content,
        },
      ],
      file: {
        name: file.name,
        path: file.path,
        size: file.size || '1 KB',
        type: file.type || 'file',
        content: file.content,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Share</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Share or export your items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Preview Banner */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 mx-4 mt-4 rounded-xl flex items-center gap-3 border border-slate-200/80 dark:border-white/5">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            {isImage && file.content ? (
              <img src={file.content} alt={file.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : isVideo ? (
              <Film className="w-6 h-6 text-amber-500" />
            ) : isFolder ? (
              <Folder className="w-6 h-6 text-amber-500 fill-amber-500/20" />
            ) : (
              <FileText className="w-6 h-6 text-blue-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">{file.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isFolder ? 'Folder' : `${file.extension?.toUpperCase() || 'File'} • ${file.size || '1 KB'}`}
            </p>
          </div>
        </div>

        {/* Action Grid */}
        <div className="p-4 grid grid-cols-2 gap-2.5 text-xs">
          <button
            onClick={handleCopyPath}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-white/10 transition-colors text-left cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <Copy className="w-4 h-4 text-blue-500 shrink-0" />}
            <div className="min-w-0">
              <span className="font-semibold block">{copiedLink ? 'Copied!' : 'Copy Path'}</span>
              <span className="text-[10px] text-slate-500 block truncate">File location</span>
            </div>
          </button>

          {file.content && !isImage && !isVideo && (
            <button
              onClick={handleCopyContent}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-200 dark:border-white/10 transition-colors text-left cursor-pointer"
            >
              {copiedContent ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <FileText className="w-4 h-4 text-purple-500 shrink-0" />}
              <div className="min-w-0">
                <span className="font-semibold block">{copiedContent ? 'Copied!' : 'Copy Content'}</span>
                <span className="text-[10px] text-slate-500 block truncate">Text data</span>
              </div>
            </button>
          )}

          <button
            onClick={handleEmailShare}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-white/10 transition-colors text-left cursor-pointer"
          >
            <Mail className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold block">Email</span>
              <span className="text-[10px] text-slate-500 block truncate">Default mail app</span>
            </div>
          </button>

          <button
            onClick={handleSendToContact}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-white/10 transition-colors text-left cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-sky-500 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold block">Contact App</span>
              <span className="text-[10px] text-slate-500 block truncate">Send message</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Windows Share API</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
