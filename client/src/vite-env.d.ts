/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:portfolio-public-media' {
  export interface PublicMediaAsset {
    name: string;
    url: string;
  }

  export interface PublicMediaManifest {
    audio: PublicMediaAsset[];
    videos: PublicMediaAsset[];
    wallpapers: PublicMediaAsset[];
    downloads: PublicMediaAsset[];
  }

  export const publicMedia: PublicMediaManifest;
}
