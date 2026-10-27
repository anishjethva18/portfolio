import { AppId } from '../types';

export interface FileTypeMetadata {
  extension: string;
  category: 'image' | 'video' | 'audio' | 'code' | 'document' | 'archive' | 'app' | 'binary';
  typeName: string;
  defaultApp: AppId;
  iconName: string;
  mimeType: string;
}

export const FILE_EXTENSIONS_MAP: Record<string, FileTypeMetadata> = {
  // Images (.jpg, .jpeg, .png, .gif, .webp, .svg, .tiff, .bmp, .heic)
  jpg: { extension: 'jpg', category: 'image', typeName: 'JPEG Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/jpeg' },
  jpeg: { extension: 'jpeg', category: 'image', typeName: 'JPEG Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/jpeg' },
  png: { extension: 'png', category: 'image', typeName: 'PNG Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/png' },
  gif: { extension: 'gif', category: 'image', typeName: 'GIF Animation', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/gif' },
  webp: { extension: 'webp', category: 'image', typeName: 'WebP Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/webp' },
  svg: { extension: 'svg', category: 'image', typeName: 'SVG Vector Graphic', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/svg+xml' },
  tiff: { extension: 'tiff', category: 'image', typeName: 'TIFF Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/tiff' },
  bmp: { extension: 'bmp', category: 'image', typeName: 'Bitmap Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/bmp' },
  heic: { extension: 'heic', category: 'image', typeName: 'HEIC High Efficiency Image', defaultApp: 'photos', iconName: 'Image', mimeType: 'image/heic' },

  // Videos (.mp4, .mov, .avi, .mkv, .wmv, .flv, .webm, .m4v)
  mp4: { extension: 'mp4', category: 'video', typeName: 'MP4 Video', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/mp4' },
  mov: { extension: 'mov', category: 'video', typeName: 'QuickTime Movie', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/quicktime' },
  avi: { extension: 'avi', category: 'video', typeName: 'AVI Video Clip', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/x-msvideo' },
  mkv: { extension: 'mkv', category: 'video', typeName: 'Matroska Video', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/x-matroska' },
  wmv: { extension: 'wmv', category: 'video', typeName: 'Windows Media Video', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/x-ms-wmv' },
  flv: { extension: 'flv', category: 'video', typeName: 'Flash Video', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/x-flv' },
  webm: { extension: 'webm', category: 'video', typeName: 'WebM Video', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/webm' },
  m4v: { extension: 'm4v', category: 'video', typeName: 'iTunes Video File', defaultApp: 'photos', iconName: 'Film', mimeType: 'video/x-m4v' },

  // Audio (.mp3, .wav, .m4a, .flac, .aac, .ogg, .wma, .aiff)
  mp3: { extension: 'mp3', category: 'audio', typeName: 'MP3 Audio', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/mpeg' },
  wav: { extension: 'wav', category: 'audio', typeName: 'Wave Audio File', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/wav' },
  m4a: { extension: 'm4a', category: 'audio', typeName: 'MPEG-4 Audio', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/mp4' },
  flac: { extension: 'flac', category: 'audio', typeName: 'FLAC Lossless Audio', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/flac' },
  aac: { extension: 'aac', category: 'audio', typeName: 'Advanced Audio Coding File', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/aac' },
  ogg: { extension: 'ogg', category: 'audio', typeName: 'Ogg Vorbis Audio', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/ogg' },
  wma: { extension: 'wma', category: 'audio', typeName: 'Windows Media Audio', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/x-ms-wma' },
  aiff: { extension: 'aiff', category: 'audio', typeName: 'Audio Interchange File Format', defaultApp: 'photos', iconName: 'Music', mimeType: 'audio/aiff' },

  // Code & Programming Languages (.py, .js, .ts, .java, .c, .cpp, .cs, .rb, .go, .rs, .php, .swift)
  py: { extension: 'py', category: 'code', typeName: 'Python Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-python' },
  js: { extension: 'js', category: 'code', typeName: 'JavaScript File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/javascript' },
  jsx: { extension: 'jsx', category: 'code', typeName: 'React JSX Component', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/javascript' },
  ts: { extension: 'ts', category: 'code', typeName: 'TypeScript Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/typescript' },
  tsx: { extension: 'tsx', category: 'code', typeName: 'TypeScript React Component', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/typescript' },
  java: { extension: 'java', category: 'code', typeName: 'Java Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-java-source' },
  c: { extension: 'c', category: 'code', typeName: 'C Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-c' },
  cpp: { extension: 'cpp', category: 'code', typeName: 'C++ Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-c++src' },
  cs: { extension: 'cs', category: 'code', typeName: 'C# Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-csharp' },
  rb: { extension: 'rb', category: 'code', typeName: 'Ruby Script File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-ruby' },
  go: { extension: 'go', category: 'code', typeName: 'Go Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-go' },
  rs: { extension: 'rs', category: 'code', typeName: 'Rust Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-rust' },
  php: { extension: 'php', category: 'code', typeName: 'PHP Hypertext Preprocessor File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-php' },
  swift: { extension: 'swift', category: 'code', typeName: 'Swift Source File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/x-swift' },
  html: { extension: 'html', category: 'code', typeName: 'HTML Document', defaultApp: 'browser', iconName: 'Globe', mimeType: 'text/html' },
  css: { extension: 'css', category: 'code', typeName: 'Cascading Style Sheet', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'text/css' },
  json: { extension: 'json', category: 'code', typeName: 'JSON Configuration File', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'application/json' },
  sql: { extension: 'sql', category: 'code', typeName: 'SQL Database Script', defaultApp: 'notepad', iconName: 'FileCode', mimeType: 'application/sql' },
  sh: { extension: 'sh', category: 'code', typeName: 'Shell Script', defaultApp: 'terminal', iconName: 'Terminal', mimeType: 'application/x-sh' },

  // Documents & Text
  txt: { extension: 'txt', category: 'document', typeName: 'Text Document', defaultApp: 'notepad', iconName: 'FileText', mimeType: 'text/plain' },
  md: { extension: 'md', category: 'document', typeName: 'Markdown Document', defaultApp: 'notepad', iconName: 'FileText', mimeType: 'text/markdown' },
  pdf: { extension: 'pdf', category: 'document', typeName: 'Adobe Acrobat PDF Document', defaultApp: 'resume', iconName: 'FileText', mimeType: 'application/pdf' },
  docx: { extension: 'docx', category: 'document', typeName: 'Microsoft Word Document', defaultApp: 'notepad', iconName: 'FileText', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  csv: { extension: 'csv', category: 'document', typeName: 'Comma-Separated Values', defaultApp: 'notepad', iconName: 'FileSpreadsheet', mimeType: 'text/csv' },
  log: { extension: 'log', category: 'document', typeName: 'System Log File', defaultApp: 'notepad', iconName: 'FileText', mimeType: 'text/plain' },

  // Archives (.zip)
  zip: { extension: 'zip', category: 'archive', typeName: 'Compressed (zipped) Folder', defaultApp: 'explorer', iconName: 'FolderArchive', mimeType: 'application/zip' },
  rar: { extension: 'rar', category: 'archive', typeName: 'WinRAR Compressed Archive', defaultApp: 'explorer', iconName: 'FolderArchive', mimeType: 'application/x-rar-compressed' },
  '7z': { extension: '7z', category: 'archive', typeName: '7-Zip Compressed Archive', defaultApp: 'explorer', iconName: 'FolderArchive', mimeType: 'application/x-7z-compressed' },

  // Shortcuts & Links
  lnk: { extension: 'lnk', category: 'app', typeName: 'Shortcut', defaultApp: 'explorer', iconName: 'Link', mimeType: 'application/x-ms-shortcut' },
  url: { extension: 'url', category: 'app', typeName: 'Internet Shortcut', defaultApp: 'browser', iconName: 'Globe', mimeType: 'text/uri-list' },
};

/**
 * Gets file metadata by extension
 */
export function getFileTypeMetadata(filenameOrExt: string): FileTypeMetadata {
  let ext = filenameOrExt.toLowerCase();
  if (ext.includes('.')) {
    ext = ext.substring(ext.lastIndexOf('.') + 1);
  }

  return (
    FILE_EXTENSIONS_MAP[ext] || {
      extension: ext,
      category: 'binary',
      typeName: `${ext ? ext.toUpperCase() : 'Unknown'} File`,
      defaultApp: 'notepad',
      iconName: 'File',
      mimeType: 'application/octet-stream',
    }
  );
}

/**
 * Checks if a file is an image
 */
export function isImageFile(filenameOrExt: string): boolean {
  const meta = getFileTypeMetadata(filenameOrExt);
  return meta.category === 'image';
}

/**
 * Checks if a file is a video
 */
export function isVideoFile(filenameOrExt: string): boolean {
  const meta = getFileTypeMetadata(filenameOrExt);
  return meta.category === 'video';
}

/**
 * Checks if a file is an audio file
 */
export function isAudioFile(filenameOrExt: string): boolean {
  const meta = getFileTypeMetadata(filenameOrExt);
  return meta.category === 'audio';
}

/**
 * Checks if a file is a media file (Image, Video, or Audio)
 */
export function isMediaFile(filenameOrExt: string): boolean {
  const meta = getFileTypeMetadata(filenameOrExt);
  return meta.category === 'image' || meta.category === 'video' || meta.category === 'audio';
}

/**
 * Checks if a file is editable text or code
 */
export function isCodeOrTextFile(filenameOrExt: string): boolean {
  const meta = getFileTypeMetadata(filenameOrExt);
  return meta.category === 'code' || meta.category === 'document';
}
