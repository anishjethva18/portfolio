import { FileItem } from '../types';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

/**
 * Download raw data, text, or Blob to the user's native computer/browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Download a FileItem to the user's real computer.
 */
export function downloadFileItem(file: FileItem) {
  const name = file.name || 'download.txt';
  const content = file.content || '';

  // Handle Base64 Data URLs (e.g. images, canvas drawings)
  if (content.startsWith('data:')) {
    try {
      const a = document.createElement('a');
      a.href = content;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
      return;
    } catch {
      // fallback to blob
    }
  }

  // Determine MIME type
  let mimeType = 'text/plain;charset=utf-8';
  const ext = (file.extension || name.split('.').pop() || 'txt').toLowerCase();

  switch (ext) {
    case 'html':
    case 'htm':
      mimeType = 'text/html;charset=utf-8';
      break;
    case 'json':
      mimeType = 'application/json;charset=utf-8';
      break;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      mimeType = 'application/javascript;charset=utf-8';
      break;
    case 'css':
      mimeType = 'text/css;charset=utf-8';
      break;
    case 'md':
      mimeType = 'text/markdown;charset=utf-8';
      break;
    case 'csv':
      mimeType = 'text/csv;charset=utf-8';
      break;
    case 'pdf':
      mimeType = 'application/pdf';
      break;
    case 'zip':
      mimeType = 'application/zip';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, name);
}

/**
 * Convert OKLCH color parameters into standard sRGB / sRGBA strings.
 * This fixes html2canvas crashes on Tailwind v4 and modern CSS colors.
 */
export function oklchToRgb(l: number, c: number, h: number, a?: number): string {
  if (isNaN(l)) l = 0;
  if (isNaN(c)) c = 0;
  if (isNaN(h)) h = 0;

  const hRad = (h * Math.PI) / 180;
  const a_val = c * Math.cos(hRad);
  const b_val = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a_val + 0.2158037573 * b_val;
  const m_ = l - 0.1055613458 * a_val - 0.0638541728 * b_val;
  const s_ = l - 0.0894841775 * a_val - 1.291485548 * b_val;

  const l_cube = l_ * l_ * l_;
  const m_cube = m_ * m_ * m_;
  const s_cube = s_ * s_ * s_;

  const r = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const g = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const b = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.707614701 * s_cube;

  const gamma = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  const R = Math.round(gamma(r) * 255);
  const G = Math.round(gamma(g) * 255);
  const B = Math.round(gamma(b) * 255);

  if (a !== undefined && !isNaN(a) && a < 1) {
    return `rgba(${R}, ${G}, ${B}, ${parseFloat(a.toFixed(3))})`;
  }
  return `rgb(${R}, ${G}, ${B})`;
}

/**
 * Replace all instances of `oklch(...)` in CSS strings with standard `rgb(...)` or `rgba(...)`
 */
export function replaceOklchInCss(cssText: string): string {
  if (!cssText || typeof cssText !== 'string') return '';
  return cssText.replace(/oklch\(\s*([^)]+)\s*\)/gi, (fullMatch, args) => {
    try {
      const slashParts = args.split('/');
      const colorParts = slashParts[0].trim().split(/\s+/);
      let alpha: number | undefined = undefined;

      if (slashParts[1]) {
        const aStr = slashParts[1].trim();
        alpha = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
      }

      if (colorParts.length >= 3) {
        let l = parseFloat(colorParts[0]);
        if (colorParts[0].endsWith('%')) l = l / 100;

        let c = parseFloat(colorParts[1]);
        if (colorParts[1].endsWith('%')) c = c / 100;

        let h = parseFloat(colorParts[2]);
        if (colorParts[2].endsWith('deg')) h = parseFloat(colorParts[2]);

        return oklchToRgb(l, c, h, alpha);
      }
    } catch {
      // fallback safe dark slate / neutral
    }
    return 'rgb(15, 23, 42)';
  });
}

/**
 * Render a DOM element to a crisp PDF and download it to the user's computer.
 * Uses native SVG rasterization via html-to-image which natively supports OKLCH, Tailwind v4, and modern CSS.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string = 'Resume.pdf'
): Promise<boolean> {
  const originalTransform = element.style.transform;
  const originalZoom = (element.style as any).zoom;

  try {
    // Temporarily normalize zoom/transform on original container for clean capture
    element.style.transform = 'none';
    (element.style as any).zoom = '1';

    // 1. Capture clean, high-DPI image using html-to-image
    const imgData = await htmlToImage.toPng(element, {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      filter: (node) => {
        // Exclude elements with class 'no-print' or non-essential controls
        if (node instanceof HTMLElement && node.classList.contains('no-print')) {
          return false;
        }
        return true;
      },
    });

    // Restore original styles
    element.style.transform = originalTransform;
    (element.style as any).zoom = originalZoom;

    // 2. Load image to get true pixel dimensions
    const img = new Image();
    img.src = imgData;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load rasterized preview image'));
    });

    // 3. Assemble PDF using jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (img.naturalHeight * imgWidth) / (img.naturalWidth || 1);
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  } catch (error) {
    // Restore original styles if error occurred before restoration
    element.style.transform = originalTransform;
    (element.style as any).zoom = originalZoom;

    console.error('Image PDF Generation fallback to vector jsPDF:', error);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const text = element.innerText || 'Resume';
      const lines = pdf.splitTextToSize(text, 520);
      let y = 40;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);

      for (let i = 0; i < lines.length; i++) {
        if (y > pageHeight - 40) {
          pdf.addPage();
          y = 40;
        }
        const line = lines[i];
        if (i === 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(18);
          pdf.text(line, 40, y);
          y += 24;
        } else if (
          line.toUpperCase() === line &&
          line.trim().length > 3 &&
          !line.includes('@') &&
          !line.includes('HTTP')
        ) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(2, 132, 199);
          y += 6;
          pdf.text(line, 40, y);
          y += 18;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(51, 65, 85);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(51, 65, 85);
          pdf.text(line, 40, y);
          y += 14;
        }
      }

      pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
      return true;
    } catch (fallbackError) {
      console.error('Vector PDF generation failed:', fallbackError);
      return false;
    }
  }
}
