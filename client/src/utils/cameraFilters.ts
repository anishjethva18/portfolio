export type CameraFilterId =
  | 'normal'
  | 'noir'
  | 'vintage'
  | 'vivid'
  | 'cyberpunk'
  | 'warm'
  | 'sepia'
  | 'matrix'
  | 'cool';

export interface FilterDefinition {
  id: CameraFilterId;
  name: string;
  cssFilter: string;
  applyToCanvas: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export const CAMERA_FILTERS: Record<CameraFilterId, FilterDefinition> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    cssFilter: 'none',
    applyToCanvas: () => {},
  },
  noir: {
    id: 'noir',
    name: 'Noir Film',
    cssFilter: 'grayscale(100%) contrast(140%) brightness(90%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrast = ((gray - 128) * 1.4) + 128;
        const clamped = Math.min(255, Math.max(0, contrast * 0.95));
        d[i] = clamped;
        d[i + 1] = clamped;
        d[i + 2] = clamped;
      }
      ctx.putImageData(imgData, 0, 0);

      // Vignette effect
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.3,
        width / 2,
        height / 2,
        width * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage 70s',
    cssFilter: 'sepia(50%) contrast(110%) saturate(120%) brightness(95%) hue-rotate(-10deg)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        d[i] = Math.min(255, r * 1.1 + 20);
        d[i + 1] = Math.min(255, g * 0.95 + 10);
        d[i + 2] = Math.min(255, b * 0.8);
      }
      ctx.putImageData(imgData, 0, 0);

      // Warm vintage overlay
      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.fillRect(0, 0, width, height);
    },
  },
  vivid: {
    id: 'vivid',
    name: 'Vivid Pop',
    cssFilter: 'saturate(160%) contrast(125%) brightness(105%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // Boost vibrancy
        d[i] = Math.min(255, Math.max(0, (d[i] - 128) * 1.25 + 130));
        d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * 1.25 + 130));
        d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * 1.25 + 130));
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    cssFilter: 'hue-rotate(180deg) saturate(180%) contrast(130%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // Shift towards cyan and magenta
        d[i] = Math.min(255, b * 1.3 + 30);
        d[i + 1] = Math.min(255, g * 0.8 + 20);
        d[i + 2] = Math.min(255, r * 1.4 + 40);
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  warm: {
    id: 'warm',
    name: 'Golden Hour',
    cssFilter: 'sepia(25%) saturate(140%) brightness(105%) hue-rotate(-15deg)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 1.15 + 10);
        d[i + 1] = Math.min(255, d[i + 1] * 1.05);
        d[i + 2] = Math.min(255, d[i + 2] * 0.88);
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  sepia: {
    id: 'sepia',
    name: 'Sepia Classic',
    cssFilter: 'sepia(85%) contrast(110%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix Phosphor',
    cssFilter: 'grayscale(100%) brightness(110%) contrast(150%) hue-rotate(90deg) invert(10%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = 0;
        d[i + 1] = Math.min(255, gray * 1.4 + 30);
        d[i + 2] = Math.min(255, gray * 0.3);
      }
      ctx.putImageData(imgData, 0, 0);

      // Scanline effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }
    },
  },
  cool: {
    id: 'cool',
    name: 'Nordic Frost',
    cssFilter: 'hue-rotate(20deg) saturate(110%) brightness(105%)',
    applyToCanvas: (ctx, width, height) => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 0.9);
        d[i + 1] = Math.min(255, d[i + 1] * 1.05 + 5);
        d[i + 2] = Math.min(255, d[i + 2] * 1.2 + 15);
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
};
