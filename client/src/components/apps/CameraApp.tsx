import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useOS } from '../../context/OSContext';
import { useAuth } from '../../context/AuthContext';
import { FileItem } from '../../types';
import { haptics } from '../../utils/haptics';
import { getZonedDateParts } from '../../utils/dateTime';
import { apiFetch } from '../../utils/apiClient';
import { D_DRIVE_FOLDER_PATHS } from '../../utils/virtualDDrive';
import {
  Camera,
  Video,
  RotateCcw,
  Grid,
  Clock,
  Square,
  Image as ImageIcon,
  Film,
  Sliders,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Sun,
  Mic,
  Folder,
  Check,
  Pause,
  Play,
  Lock,
  RefreshCw,
  SwitchCamera,
  X,
} from 'lucide-react';
import {
  captureStorageService,
  LOCAL_CAPTURE_CONTENT_PREFIX,
  LocalCaptureRecord,
  MAX_CAPTURE_BYTES,
} from '../../services/captureStorageService';
import { normalizeVfsDestinationPath } from '../../utils/virtualDDrive';

type CameraMode = 'photo' | 'video';
type FilterType = 'normal' | 'noir' | 'vintage' | 'vivid' | 'cinematic' | 'warm';

export const CameraApp: React.FC = () => {
  const { createFile, updateFileAttributes, files, openApp, addNotification, settings } = useOS();
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const isLight = settings?.theme === 'light';
  const isLocalCameraHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);

  const [mode, setMode] = useState<CameraMode>('photo');
  const [filter, setFilter] = useState<FilterType>('normal');
  const [showGrid, setShowGrid] = useState<0 | 1 | 2>(0); // 0: off, 1: 3x3, 2: golden ratio
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Default isMirrored to false (Mirror Mode enabled by default for Front Camera / Selfie Mode)
  const [isMirrored, setIsMirrored] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [showProControls, setShowProControls] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [recentCapturePreview, setRecentCapturePreview] = useState('');

  // Editable Save Locations
  const [photoSavePath, setPhotoSavePath] = useState<string>(D_DRIVE_FOLDER_PATHS.photoCaptures);
  const [videoSavePath, setVideoSavePath] = useState<string>(D_DRIVE_FOLDER_PATHS.videoCaptures);

  // Settings Panel Config
  const [photoResolution, setPhotoResolution] = useState<'1080p' | '4k' | '720p'>('1080p');
  const [photoRatio, setPhotoRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [videoQuality, setVideoQuality] = useState<'1080p60' | '1080p30' | '720p30'>('1080p60');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');

  // Stream state & Permissions
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVirtualCamera, setIsVirtualCamera] = useState(false);
  const archiveRequestsRef = useRef(new Set<string>());

  const archiveCapturedMedia = async (capture: LocalCaptureRecord, localOnly: boolean) => {
    const formData = new FormData();
    formData.append('mediaType', capture.mediaType);
    formData.append('file', new File([capture.blob], capture.fileName, { type: capture.mimeType }), capture.fileName);
    const response = await apiFetch(localOnly ? '/api/captures/local' : '/api/captures/admin', { method: 'POST', body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Secure camera archive could not save this capture.');
    return String(result.capture?.id || '');
  };

  const archiveCaptureInBackground = async (capture: LocalCaptureRecord, localOnly: boolean): Promise<void> => {
    if (archiveRequestsRef.current.has(capture.id)) return;
    archiveRequestsRef.current.add(capture.id);
    try {
      await captureStorageService.update(capture.id, { archiveStatus: 'uploading', archiveError: undefined });
      updateFileAttributes(capture.filePath, { captureStatus: 'uploading' });
      const archiveId = await archiveCapturedMedia(capture, localOnly);
      if (!archiveId) throw new Error('The server did not return an archive identifier.');
      await captureStorageService.update(capture.id, { archiveStatus: 'archived', archiveId, archiveError: undefined });
      updateFileAttributes(capture.filePath, { captureStatus: 'archived', archiveId });
      addNotification({
        title: 'Capture Archived',
        message: 'The capture is saved on this device and a separate copy was sent to the administrator archive.',
        type: 'success',
        appId: 'camera',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The archive upload failed.';
      try {
        await captureStorageService.update(capture.id, { archiveStatus: 'archive-failed', archiveError: message });
      } catch (storageError) {
        console.error('[CameraApp] Could not update local archive status.', storageError);
      }
      updateFileAttributes(capture.filePath, { captureStatus: 'archive-failed' });
      addNotification({
        title: 'Archive Upload Failed',
        message: `${message} The local capture remains on this device.`,
        type: 'warning',
        appId: 'camera',
      });
    } finally {
      archiveRequestsRef.current.delete(capture.id);
    }
  };

  const saveCaptureLocally = async (
    blob: Blob,
    fileName: string,
    mediaType: 'photo' | 'video',
    folderPath: string
  ): Promise<void> => {
    if (!blob.size || blob.size > MAX_CAPTURE_BYTES) {
      throw new Error(`Capture must be between 1 byte and ${Math.floor(MAX_CAPTURE_BYTES / 1024 / 1024)} MB.`);
    }
    const id = `local_capture_${crypto.randomUUID()}`;
    const filePath = `${normalizeVfsDestinationPath(folderPath)}/${fileName}`;
    const record: LocalCaptureRecord = {
      id,
      fileName,
      filePath,
      mediaType,
      mimeType: blob.type || (mediaType === 'video' ? 'video/webm' : 'image/jpeg'),
      blob,
      createdAt: new Date().toISOString(),
      archiveStatus: 'local-only',
    };

    await captureStorageService.save(record);
    createFile(folderPath, fileName, `${LOCAL_CAPTURE_CONTENT_PREFIX}${id}`, fileName.split('.').pop() || '', {
      localCaptureId: id,
      captureStatus: 'local-only',
    });
    if (isLocalCameraHost || (isAdmin && !isAuthLoading)) {
      void archiveCaptureInBackground(record, !isAdmin);
    }
  };

  useEffect(() => {
    if (!isLocalCameraHost) return;
    let isCurrent = true;
    void captureStorageService.list().then((captures) => {
      if (!isCurrent) return;
      captures
        .filter((capture) => capture.archiveStatus === 'local-only' || capture.archiveStatus === 'archive-failed')
        .forEach((capture) => void archiveCaptureInBackground(capture, true));
    }).catch((error: unknown) => {
      console.error('[CameraApp] Could not recover local captures for the admin archive.', error);
      addNotification({
        title: 'Local archive recovery failed',
        message: error instanceof Error ? error.message : 'Previously saved captures could not be listed.',
        type: 'warning',
        appId: 'camera',
      });
    });
    return () => {
      isCurrent = false;
    };
  }, [isLocalCameraHost]);

  // Cached device IDs for instant switching without re-enumeration
  const cachedUserDeviceIdRef = useRef<string>('');
  const cachedEnvironmentDeviceIdRef = useRef<string>('');

  // Video recording state & Pause support
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // DOM elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Last captured thumbnail - reactively synchronized with files state
  const lastMedia = useMemo(() => {
    const mediaFiles = files.filter(
      (f) =>
        !f.deletedAt &&
        !f.parentId?.includes('recycle') &&
        (f.extension === 'png' ||
          f.extension === 'jpg' ||
          f.extension === 'jpeg' ||
          f.extension === 'webp' ||
          f.extension === 'mp4' ||
          f.extension === 'webm' ||
          f.extension === 'mov') &&
        Boolean(f.content)
    );

    if (mediaFiles.length === 0) return null;

    const parseFileTimestamp = (file: FileItem): number => {
      const matchCompact = file.name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
      if (matchCompact) {
        const [, year, month, day, hour, min, sec] = matchCompact;
        const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
        return d.getTime();
      }
      const matchHyphen = file.name.match(/(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/);
      if (matchHyphen) {
        const [, year, month, day, hour, min, sec] = matchHyphen;
        const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
        return d.getTime();
      }
      if (file.modified) {
        const parsed = Date.parse(file.modified);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return 0;
    };

    const sorted = [...mediaFiles].sort((a, b) => {
      const timeA = parseFileTimestamp(a);
      const timeB = parseFileTimestamp(b);
      if (timeA !== timeB) return timeB - timeA;
      return b.name.localeCompare(a.name);
    });

    const last = sorted[0];
    const isVideo = ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes((last.extension || '').toLowerCase());
    return {
      path: last.path,
      url: last.content || '',
      type: isVideo ? ('video' as const) : ('photo' as const),
      localCaptureId: last.localCaptureId,
      captureStatus: last.captureStatus,
    };
  }, [files]);

  useEffect(() => {
    let objectUrl = '';
    let isCurrent = true;
    if (lastMedia?.localCaptureId) {
      void captureStorageService.get(lastMedia.localCaptureId).then((capture) => {
        if (!isCurrent || !capture) return;
        objectUrl = URL.createObjectURL(capture.blob);
        setRecentCapturePreview(objectUrl);
      }).catch((error: unknown) => {
        console.error('[CameraApp] Could not load the recent local capture preview.', error);
      });
    } else {
      setRecentCapturePreview(lastMedia?.url || '');
    }
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lastMedia?.localCaptureId, lastMedia?.url]);

  // Shutter flash animation effect
  const [shutterFlash, setShutterFlash] = useState(false);

  // Fetch available devices
  const refreshDevices = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices.filter((d) => d.kind === 'videoinput');
        const aDevs = devices.filter((d) => d.kind === 'audioinput');
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs.length > 0 && !selectedVideoId) setSelectedVideoId(vDevs[0].deviceId);
        if (aDevs.length > 0 && !selectedAudioId) setSelectedAudioId(aDevs[0].deviceId);
      } catch (e) {
        console.warn('Error enumerating devices:', e);
      }
    }
  }, [selectedVideoId, selectedAudioId]);

  // Initialize Real Camera & Mic Stream with instant cached device reuse and hardware facingMode reliability
  const initCamera = useCallback(
    async (customVideoId?: string, customAudioId?: string, customFacingMode?: 'user' | 'environment') => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera APIs are not supported in this browser.');
        }

        // Stop existing tracks immediately
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (videoRef.current && videoRef.current.srcObject) {
          const prevStream = videoRef.current.srcObject as MediaStream;
          if (prevStream && prevStream.getTracks) {
            prevStream.getTracks().forEach((t) => t.stop());
          }
          videoRef.current.srcObject = null;
        }

        let idealW = 1920;
        let idealH = 1080;
        let idealFps = 30;

        if (photoResolution === '4k') {
          idealW = 3840;
          idealH = 2160;
        } else if (photoResolution === '720p') {
          idealW = 1280;
          idealH = 720;
        }

        if (videoQuality === '1080p60') {
          idealFps = 60;
        }

        const activeFacing = customFacingMode || facingMode;
        const vId = customVideoId !== undefined ? customVideoId : selectedVideoId;
        const aId = customAudioId || selectedAudioId;
        const aConstraint: MediaTrackConstraints | boolean = aId ? { deviceId: { ideal: aId } } : soundEnabled;

        // Clean up previous tracks to prevent device locks
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (videoRef.current && videoRef.current.srcObject) {
          const s = videoRef.current.srcObject as MediaStream;
          if (s && s.getTracks) {
            s.getTracks().forEach((t) => t.stop());
          }
          videoRef.current.srcObject = null;
        }

        let mediaStream: MediaStream | null = null;

        const tryGetStream = async (videoConstraints: any, withAudio: boolean): Promise<MediaStream | null> => {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: videoConstraints,
              audio: withAudio ? aConstraint : false,
            });
          } catch {
            if (withAudio) {
              try {
                return await navigator.mediaDevices.getUserMedia({
                  video: videoConstraints,
                  audio: false,
                });
              } catch {
                return null;
              }
            }
            return null;
          }
        };

        // 0. If a specific camera device was explicitly chosen by the user, prioritize it FIRST!
        if (vId) {
          mediaStream = await tryGetStream(
            {
              deviceId: { exact: vId },
              width: { ideal: idealW },
              height: { ideal: idealH },
              frameRate: { ideal: idealFps },
            },
            true
          );
          if (!mediaStream) {
            mediaStream = await tryGetStream(
              {
                deviceId: { ideal: vId },
                width: { ideal: idealW },
                height: { ideal: idealH },
                frameRate: { ideal: idealFps },
              },
              true
            );
          }
        }

        // 1. Try ideal facingMode with ideal resolution
        if (!mediaStream) {
          mediaStream = await tryGetStream(
            {
              facingMode: { ideal: activeFacing },
              width: { ideal: idealW },
              height: { ideal: idealH },
              frameRate: { ideal: idealFps },
            },
            true
          );
        }

        // 2. Try simple facingMode string constraint (most compatible on mobile browsers)
        if (!mediaStream) {
          mediaStream = await tryGetStream(
            {
              facingMode: activeFacing,
            },
            true
          );
        }

        // 3. Try deviceId enumeration matching back/front labels or index
        if (!mediaStream) {
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const vDevs = devs.filter((d) => d.kind === 'videoinput');
            setVideoDevices(vDevs);
            if (vDevs.length > 0) {
              let targetDev = vDevs[0];
              if (activeFacing === 'environment') {
                const backDev = vDevs.find((d) => {
                  const l = (d.label || '').toLowerCase();
                  return (
                    l.includes('back') ||
                    l.includes('rear') ||
                    l.includes('environment') ||
                    l.includes('main') ||
                    l.includes('wide') ||
                    l.includes('0')
                  );
                });
                targetDev = backDev || (vDevs.length > 1 ? vDevs[1] : vDevs[vDevs.length - 1]);
              } else {
                const frontDev = vDevs.find((d) => {
                  const l = (d.label || '').toLowerCase();
                  return (
                    l.includes('front') ||
                    l.includes('user') ||
                    l.includes('selfie') ||
                    l.includes('1')
                  );
                });
                targetDev = frontDev || vDevs[0];
              }

              mediaStream = await tryGetStream(
                {
                  deviceId: { ideal: targetDev.deviceId },
                  width: { ideal: idealW },
                  height: { ideal: idealH },
                },
                true
              );
            }
          } catch {}
        }

        // 4. Try exact facingMode constraint
        if (!mediaStream) {
          mediaStream = await tryGetStream(
            {
              facingMode: { exact: activeFacing },
            },
            true
          );
        }

        // 4. Try cached or custom device ID if still null
        const cachedId = vId || (activeFacing === 'user' ? cachedUserDeviceIdRef.current : cachedEnvironmentDeviceIdRef.current);
        if (!mediaStream && cachedId) {
          mediaStream = await tryGetStream(
            {
              deviceId: { exact: cachedId },
              width: { ideal: idealW },
              height: { ideal: idealH },
            },
            true
          );
        }

        // 5. Final generic fallback
        if (!mediaStream) {
          mediaStream = await tryGetStream(true, false);
        }

        if (!mediaStream) {
          throw new Error('No physical media stream could be obtained from user devices.');
        }

        const previousStream = streamRef.current;
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (previousStream && previousStream !== mediaStream) {
          previousStream.getTracks().forEach((track) => track.stop());
        }
        setIsVirtualCamera(false);

        // Mirror logic: Front/user camera has mirror ON by default (isMirrored = false); Environment/rear camera has mirror OFF (isMirrored = true)
        setIsMirrored(activeFacing !== 'user');

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const trackSettings = videoTrack.getSettings ? videoTrack.getSettings() : {};
          const finalId = trackSettings.deviceId || vId;
          if (finalId) {
            setSelectedVideoId(finalId);
            if (activeFacing === 'user') {
              cachedUserDeviceIdRef.current = finalId;
            } else {
              cachedEnvironmentDeviceIdRef.current = finalId;
            }
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((e) => console.warn('Video auto-play warning:', e));
          };
        }

        refreshDevices();
      } catch (err: any) {
        console.warn('Physical camera/mic unavailable, switching to virtual simulation:', err);
        setIsVirtualCamera(true);
      }
    },
    [photoResolution, videoQuality, selectedVideoId, selectedAudioId, facingMode, soundEnabled, refreshDevices]
  );

  // Switch between front and back / rear cameras with immediate track cleanup and cache reset
  const handleSwitchCamera = useCallback(async () => {
    const nextFacing: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    setIsMirrored(nextFacing !== 'user'); // false for user/front (mirror enabled), true for environment/rear (mirror disabled)
    setSelectedVideoId('');
    setIsVirtualCamera(false);
    haptics.medium();

    // Explicitly stop all active tracks immediately before re-init and clear cache for target facing
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      if (s && s.getTracks) {
        s.getTracks().forEach((t) => t.stop());
      }
      videoRef.current.srcObject = null;
    }

    if (nextFacing === 'environment') {
      cachedEnvironmentDeviceIdRef.current = '';
    } else {
      cachedUserDeviceIdRef.current = '';
    }

    // Give browser/OS camera sensor 5ms to cleanly release hardware locks before switching
    await new Promise((r) => setTimeout(r, 5));

    await initCamera('', selectedAudioId, nextFacing);

    addNotification({
      title: 'Camera Switched',
      message: nextFacing === 'user' ? 'Front Camera (Selfie)' : 'Rear / Back Camera',
      type: 'info',
      appId: 'camera',
    });
  }, [facingMode, selectedAudioId, stream, initCamera, addNotification]);

  useEffect(() => {
    initCamera();
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [photoResolution, videoQuality]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Sync stream to video element when stream is updated
  useEffect(() => {
    if (stream && videoRef.current && !isVirtualCamera) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {});
      };
    }
  }, [stream, isVirtualCamera]);

  // Virtual Camera Animation Canvas (Realistic fallback simulation)
  useEffect(() => {
    if (!isVirtualCamera || !virtualCanvasRef.current) return;
    const canvas = virtualCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const renderVirtualFeed = () => {
      time += 0.03;
      const w = (canvas.width = 1280);
      const h = (canvas.height = 720);

      ctx.save();
      // Interchanged mirror logic per user request:
      // When isMirrored is false, apply horizontal flip; when isMirrored is true, keep standard orientation
      if (!isMirrored) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      // Dark sleek studio gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#0b0f19');
      bgGrad.addColorStop(0.5, '#1e1b4b');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Animated Cyber Mesh / Studio Depth circles
      for (let i = 0; i < 6; i++) {
        const rad = 100 + i * 50 + Math.sin(time + i) * 20;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.14 - i * 0.02})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.max(10, rad), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Studio Face tracking box & crosshairs
      const headX = w / 2 + Math.sin(time * 0.8) * 30;
      const headY = h / 2 - 30 + Math.cos(time * 0.5) * 15;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(headX - 90, headY - 100, 180, 200);

      // Crosshair corners
      const crossSize = 14;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(headX - 90, headY - 100 + crossSize);
      ctx.lineTo(headX - 90, headY - 100);
      ctx.lineTo(headX - 90 + crossSize, headY - 100);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headX + 90 - crossSize, headY - 100);
      ctx.lineTo(headX + 90, headY - 100);
      ctx.lineTo(headX + 90, headY - 100 + crossSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headX - 90, headY + 100 - crossSize);
      ctx.lineTo(headX - 90, headY + 100);
      ctx.lineTo(headX - 90 + crossSize, headY + 100);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headX + 90 - crossSize, headY + 100);
      ctx.lineTo(headX + 90, headY + 100);
      ctx.lineTo(headX + 90, headY + 100 - crossSize);
      ctx.stroke();

      // Stylized Avatar Silhouette
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(headX, headY - 20, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.ellipse(headX, headY + 95, 90, 60, 0, 0, Math.PI);
      ctx.fill();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(renderVirtualFeed);
    };

    renderVirtualFeed();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isVirtualCamera, isMirrored]);

  // Audio effects
  const playShutterSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // ignore
    }
  };

  const getFilterStyle = (): string => {
    let filterCss = `brightness(${brightness}%) contrast(${contrast}%) `;
    switch (filter) {
      case 'noir':
        filterCss += 'grayscale(100%) contrast(140%)';
        break;
      case 'vintage':
        filterCss += 'sepia(60%) hue-rotate(-20deg) saturate(130%)';
        break;
      case 'vivid':
        filterCss += 'saturate(160%) contrast(115%)';
        break;
      case 'cinematic':
        filterCss += 'contrast(125%) saturate(110%) brightness(95%) sepia(10%) hue-rotate(-5deg)';
        break;
      case 'warm':
        filterCss += 'sepia(25%) saturate(120%) brightness(105%)';
        break;
      default:
        break;
    }
    return filterCss.trim();
  };

  const applyFilterToContext = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (filter === 'noir') {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = avg;
        d[i + 1] = avg;
        d[i + 2] = avg;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (filter === 'vintage') {
      ctx.fillStyle = 'rgba(180, 120, 50, 0.2)';
      ctx.fillRect(0, 0, width, height);
    } else if (filter === 'cinematic') {
      ctx.fillStyle = 'rgba(0, 100, 255, 0.05)';
      ctx.fillRect(0, 0, width, height);
    }
  };

  const getFormattedDateString = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const parts = getZonedDateParts(now);
    return `${parts.year}${pad(parts.month)}${pad(parts.day)}_${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`;
  };

  // Perform photo capture with exact quality and aspect-ratio framing
  const performPhotoCapture = () => {
    if (isVirtualCamera) {
      addNotification({
        title: 'Virtual Camera (View-Only)',
        message: 'Photo capture is disabled while Virtual Camera is enabled. Connect a physical camera to take photos.',
        type: 'warning',
        appId: 'camera',
      });
      return;
    }

    playShutterSound();

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    const canvas = document.createElement('canvas');
    let frameReady = false;

    // Calculate dimensions based on photoResolution ('4k' | '1080p' | '720p') and photoRatio ('16:9' | '4:3' | '1:1')
    let targetW = 1920;
    let targetH = 1080;

    if (photoResolution === '4k') {
      if (photoRatio === '16:9') { targetW = 3840; targetH = 2160; }
      else if (photoRatio === '4:3') { targetW = 2880; targetH = 2160; }
      else if (photoRatio === '1:1') { targetW = 2160; targetH = 2160; }
    } else if (photoResolution === '720p') {
      if (photoRatio === '16:9') { targetW = 1280; targetH = 720; }
      else if (photoRatio === '4:3') { targetW = 960; targetH = 720; }
      else if (photoRatio === '1:1') { targetW = 720; targetH = 720; }
    } else {
      // 1080p
      if (photoRatio === '16:9') { targetW = 1920; targetH = 1080; }
      else if (photoRatio === '4:3') { targetW = 1440; targetH = 1080; }
      else if (photoRatio === '1:1') { targetW = 1080; targetH = 1080; }
    }

    canvas.width = targetW;
    canvas.height = targetH;

    if (!isVirtualCamera && videoRef.current && videoRef.current.videoWidth > 0) {
      const srcW = videoRef.current.videoWidth;
      const srcH = videoRef.current.videoHeight;
      const targetAspect = targetW / targetH;
      const srcAspect = srcW / srcH;

      let sWidth = srcW;
      let sHeight = srcH;
      let sx = 0;
      let sy = 0;

      if (srcAspect > targetAspect) {
        sWidth = srcH * targetAspect;
        sx = (srcW - sWidth) / 2;
      } else {
        sHeight = srcW / targetAspect;
        sy = (srcH - sHeight) / 2;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Interchanged mirror logic per user request:
        // When isMirrored is false, flip horizontally; when isMirrored is true, keep standard capture
        if (!isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        applyFilterToContext(ctx, canvas.width, canvas.height);

        frameReady = true;
      }
    }

    if (!frameReady) {
      addNotification({
        title: 'Photo capture failed',
        message: 'The camera has no ready video frame. Wait for the live preview, then try again.',
        type: 'error',
        appId: 'camera',
      });
      return;
    }

    const timestamp = getFormattedDateString();
    const fileName = `Photo_${timestamp}.jpg`;
    const folderPath = photoSavePath || D_DRIVE_FOLDER_PATHS.photoCaptures;
    canvas.toBlob((blob) => {
      if (!blob) {
        addNotification({ title: 'Photo capture failed', message: 'The browser could not encode the photo for local storage.', type: 'error', appId: 'camera' });
        return;
      }
      void saveCaptureLocally(blob, fileName, 'photo', folderPath).then(() => {
        addNotification({
          title: 'Photo Captured',
          message: isAdmin
            ? `Saved locally (${photoResolution.toUpperCase()} ${photoRatio}) to ${folderPath}/${fileName}. Sending a separate administrator-archive copy.`
            : `Saved locally (${photoResolution.toUpperCase()} ${photoRatio}) to ${folderPath}/${fileName}.`,
          type: 'success',
          appId: 'camera',
        });
      }).catch((error: unknown) => {
        addNotification({
          title: 'Local photo save failed',
          message: error instanceof Error ? error.message : 'The browser could not save this photo locally.',
          type: 'error',
          appId: 'camera',
        });
      });
    }, 'image/jpeg', 0.95);
  };

  // Record using a format supported by this browser
  const startRecording = () => {
    if (isVirtualCamera) {
      addNotification({
        title: 'Virtual Camera (View-Only)',
        message: 'Video recording is disabled while Virtual Camera is enabled. Connect a physical camera to record videos.',
        type: 'warning',
        appId: 'camera',
      });
      return;
    }

    let recStream: MediaStream | null = stream;

    recordedChunksRef.current = [];
    if (!recStream || typeof MediaRecorder === 'undefined') {
      addNotification({ title: 'Video recording unavailable', message: 'Connect a camera and use a browser that supports video recording, then try again.', type: 'warning', appId: 'camera' });
      return;
    }

    const mime = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mime) {
      addNotification({ title: 'Video recording unavailable', message: 'This browser does not support MP4 or WebM recording. No capture was created.', type: 'warning', appId: 'camera' });
      return;
    }

    try {
        const mediaRecorder = new MediaRecorder(recStream, { mimeType: mime });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mime });
          const timestamp = getFormattedDateString();
          const recordedMime = blob.type.toLowerCase();
          const extension = recordedMime.includes('mp4') ? 'mp4' : recordedMime.includes('webm') ? 'webm' : '';
          if (!extension) {
            addNotification({ title: 'Video recording failed', message: `The browser returned an unsupported recording type (${blob.type || 'unknown'}). The video was not saved with an incorrect extension.`, type: 'error', appId: 'camera' });
            return;
          }
          const fileName = `Video_${timestamp}.${extension}`;
          const folderPath = videoSavePath || D_DRIVE_FOLDER_PATHS.videoCaptures;
          if (!blob.size) {
            addNotification({ title: 'Empty recording', message: 'No video frames were recorded. Please record again.', type: 'warning', appId: 'camera' });
            return;
          }
          void saveCaptureLocally(blob, fileName, 'video', folderPath).then(() => {
            addNotification({
              title: 'Video Recorded',
              message: isAdmin
                ? `Saved locally to ${folderPath}/${fileName}. Sending a separate administrator-archive copy.`
                : `Saved locally to ${folderPath}/${fileName}.`,
              type: 'success',
              appId: 'camera',
            });
          }).catch((error: unknown) => {
            addNotification({
              title: 'Local video save failed',
              message: error instanceof Error ? error.message : 'The browser could not save this video locally.',
              type: 'error',
              appId: 'camera',
            });
          });
        };

        mediaRecorder.start(1000);
        setIsPaused(false);
        setIsRecording(true);
        setRecordDuration(0);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        recordTimerRef.current = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
      } catch (err) {
        setIsRecording(false);
        addNotification({ title: 'Video recording failed', message: 'The browser could not start a real camera recording.', type: 'error', appId: 'camera' });
        console.warn('MediaRecorder error:', err);
      }
  };

  // Pause / Resume Video Recording
  const pauseRecording = () => {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
      } catch {}
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsPaused(true);
  };

  const resumeRecording = () => {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
      } catch {}
    }
    setIsPaused(false);
    if (!recordTimerRef.current) {
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleShutterClick = () => {
    if (isVirtualCamera) {
      addNotification({
        title: 'Virtual Camera (View-Only Mode)',
        message:
          mode === 'video'
            ? 'Video recording is disabled during Virtual Camera simulation. You can only view the live feed.'
            : 'Photo capture is disabled during Virtual Camera simulation. You can only view the live feed.',
        type: 'warning',
        appId: 'camera',
      });
      return;
    }

    if (mode === 'video') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      return;
    }

    if (timerSeconds > 0) {
      setCountdown(timerSeconds);
      let count = timerSeconds;
      const timer = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(timer);
          setCountdown(null);
          performPhotoCapture();
        }
      }, 1000);
    } else {
      performPhotoCapture();
    }
  };

  const formatDuration = (seconds: number) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
      return '00:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div data-testid="camera-app-root" className="relative flex flex-col sm:flex-row h-full w-full bg-slate-100 dark:bg-[#18181b] text-slate-900 dark:text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. MAIN VIEWFINDER (Center Stage) */}
      <div className="relative flex-1 flex flex-col h-full w-full overflow-hidden bg-black min-h-0">
        
        {/* Floating Quick Settings Strip (Top Left) */}
        <div className={`absolute top-3 left-3 sm:top-4 sm:left-4 z-30 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-lg max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none border ${
          isLight ? 'bg-white/90 border-slate-300 text-slate-800 backdrop-blur-md' : 'bg-black/75 border-white/10 text-white backdrop-blur-md'
        }`}>
          {/* Flip / Switch Front & Back Camera (Only visible on Mobile & Tablet views) */}
          <button
            onClick={handleSwitchCamera}
            className={`max-lg:flex lg:hidden items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
              facingMode === 'environment'
                ? isLight
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 font-bold shadow'
                  : 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title={`Flip Camera: Currently ${facingMode === 'user' ? 'Front (Selfie)' : 'Back (Rear)'} (Click to switch)`}
          >
            <SwitchCamera className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
          </button>

          {/* Framing Aspect Ratio Quick Toggle */}
          <button
            onClick={() => {
              setPhotoRatio((prev) => (prev === '16:9' ? '4:3' : prev === '4:3' ? '1:1' : '16:9'));
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer shadow shrink-0 ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-cyan-700 hover:bg-slate-200'
                : 'bg-white/5 border-white/10 text-cyan-300 hover:bg-white/10'
            }`}
            title={`Framing Aspect Ratio: ${photoRatio} (Click to change)`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>{photoRatio}</span>
          </button>

          {/* Timer Toggle */}
          <button
            onClick={() => {
              setTimerSeconds((prev) => (prev === 0 ? 3 : prev === 3 ? 5 : prev === 5 ? 10 : 0));
            }}
            className={`rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
              timerSeconds > 0
                ? `flex items-center gap-1 px-2 py-1 ${
                    isLight
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 shadow font-bold'
                      : 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow'
                  }`
                : `p-1.5 ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`
            }`}
            title="Self-Timer"
          >
            <Clock className="w-3.5 h-3.5" />
            {timerSeconds > 0 && <span>{timerSeconds}s</span>}
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid((prev) => ((prev + 1) % 3) as any)}
            className={`p-1.5 rounded-xl text-xs transition-all cursor-pointer border shrink-0 ${
              showGrid > 0
                ? isLight
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 font-bold'
                  : 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title={showGrid === 1 ? 'Grid: 3x3' : showGrid === 2 ? 'Grid: Golden Ratio' : 'Grid: Off'}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Pro Mode / Exposure controls */}
          <button
            onClick={() => setShowProControls(!showProControls)}
            className={`p-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
              showProControls
                ? isLight
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 font-bold'
                  : 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Exposure & Brightness"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Mirror Flip (Live Horizontal Flip) */}
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-1.5 rounded-xl text-xs transition-all cursor-pointer border ${
              isMirrored
                ? isLight
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 font-bold'
                  : 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title={isMirrored ? 'Mirror Camera: ON (Standard / Non-Mirrored)' : 'Mirror Camera: OFF (Mirrored)'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Shutter Sound */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-xl text-xs border cursor-pointer ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title={soundEnabled ? 'Mute Shutter Sound' : 'Enable Shutter Sound'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />}
          </button>

          {/* Settings Modal Toggle */}
          <button
            onClick={() => {
              refreshDevices();
              setShowSettingsModal(!showSettingsModal);
            }}
            className={`p-1.5 rounded-xl text-xs border cursor-pointer ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Camera Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top Right: Connect Physical Camera if virtual */}
        {isVirtualCamera && (
          <button
            onClick={() => initCamera()}
            className="absolute top-14 right-3 sm:top-16 sm:right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 text-xs font-semibold backdrop-blur-md shadow-lg cursor-pointer transition-all active:scale-95"
            title="Click to request / reconnect physical camera"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
            <span>Virtual Camera (Click to Connect Real Camera)</span>
          </button>
        )}

        {/* Pro Mode Floating Sliders */}
        {showProControls && (
          <div className="absolute top-16 left-4 z-30 bg-black/85 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shadow-xl space-y-3 w-64 text-xs animate-in slide-in-from-top-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" /> Brightness
                </span>
                <span className="font-mono">{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1 bg-white/20 rounded cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Contrast</span>
                <span className="font-mono">{contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1 bg-white/20 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Viewfinder Video Element with Aspect Ratio Framing Mask */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {!isVirtualCamera && stream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-200"
              style={{
                filter: getFilterStyle(),
                transform: `${!isMirrored ? 'scaleX(-1)' : 'scaleX(1)'} scale(${zoomLevel})`,
              }}
            />
          )}

          {/* Virtual Canvas Fallback */}
          <canvas
            ref={virtualCanvasRef}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-200 ${
              isVirtualCamera || !stream ? 'block' : 'hidden'
            }`}
            style={{
              filter: getFilterStyle(),
              transform: `${!isMirrored ? 'scaleX(-1)' : 'scaleX(1)'} scale(${zoomLevel})`,
            }}
          />

          {/* Framing Guides Overlay (4:3 and 1:1 letterboxing preview) */}
          {photoRatio === '4:3' && (
            <div className="absolute inset-0 pointer-events-none flex justify-between z-10">
              <div className="w-[12%] h-full bg-black/65 backdrop-blur-[1px] border-r border-white/20" />
              <div className="w-[12%] h-full bg-black/65 backdrop-blur-[1px] border-l border-white/20" />
            </div>
          )}
          {photoRatio === '1:1' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
              <div className="w-full flex-1 bg-black/70 backdrop-blur-[1px] border-b border-white/20" />
              <div className="w-full aspect-square max-h-full border border-cyan-400/40 relative shadow-inner" />
              <div className="w-full flex-1 bg-black/70 backdrop-blur-[1px] border-t border-white/20" />
            </div>
          )}

          {/* Rule of Thirds Grid */}
          {showGrid === 1 && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
              <div className="border-r border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div className="border-r border-b border-white/25" />
              <div />
            </div>
          )}

          {/* Golden Ratio Grid */}
          {showGrid === 2 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-2/3 h-2/3 border border-white/35 rounded-full" />
              <div className="absolute w-1/3 h-1/3 border border-cyan-400/50 rounded-full" />
            </div>
          )}

          {/* Shutter White Flash Effect */}
          {shutterFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150 pointer-events-none" />}

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 pointer-events-none">
              <div className="text-9xl font-black text-cyan-400 animate-ping drop-shadow-2xl">{countdown}</div>
            </div>
          )}

          {/* Active Video Recording Badge & Pause Button */}
          {isRecording && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 border border-rose-500/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-mono font-bold z-30 shadow-2xl">
              <span className={`w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-rose-500 animate-ping'}`} />
              <span className="tracking-wider">{isPaused ? 'PAUSED' : 'REC'} {formatDuration(recordDuration)}</span>
              
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-sans text-[11px] transition-colors cursor-pointer"
                title={isPaused ? 'Resume Video Recording' : 'Pause Video Recording'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          )}

          {/* Floating Zoom Control Pill (Bottom Center) */}
          <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full shadow-xl border ${
            isLight ? 'bg-white/90 border-slate-300 text-slate-800 backdrop-blur-md' : 'bg-black/70 border-white/15 text-white backdrop-blur-md'
          }`}>
            {[1, 2, 5].map((z) => (
              <button
                key={z}
                onClick={() => setZoomLevel(z)}
                className={`w-7 h-7 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  zoomLevel === z
                    ? 'bg-cyan-500 text-white shadow scale-105'
                    : isLight
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* Bottom Filter Chips Strip */}
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full shadow-xl max-w-[90%] overflow-x-auto scrollbar-none border ${
            isLight ? 'bg-white/90 border-slate-300 text-slate-800 backdrop-blur-md' : 'bg-black/70 border-white/15 text-white backdrop-blur-md'
          }`}>
            {(['normal', 'noir', 'vintage', 'vivid', 'cinematic', 'warm'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition-all capitalize cursor-pointer shrink-0 ${
                  filter === f
                    ? 'bg-cyan-500 text-white shadow-sm font-bold'
                    : isLight
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. WINDOWS 11 CONTROL DOCK (Responsive: Bottom bar on mobile, Right sidebar on desktop) */}
      <div className={`w-full h-24 sm:h-full sm:w-24 md:sm:w-28 flex flex-row sm:flex-col items-center justify-around sm:justify-between py-2 sm:py-6 px-4 sm:px-2 z-30 shrink-0 select-none border-t sm:border-t-0 sm:border-l ${
        isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#18181b] border-white/10 text-slate-100'
      }`}>
        {/* Mode Selector (Photo & Video) */}
        <div className="flex flex-row sm:flex-col items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Photo Mode */}
          <button
            onClick={() => {
              if (isRecording) stopRecording();
              setMode('photo');
            }}
            className={`group flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
              mode === 'photo'
                ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/30 shadow'
                : isLight
                ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/60'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Photo Mode"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-[11px] font-medium">Photo</span>
          </button>

          {/* Video Mode */}
          <button
            onClick={() => setMode('video')}
            className={`group flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
              mode === 'video'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 shadow'
                : isLight
                ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/60'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Video Mode"
          >
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-[11px] font-medium">Video</span>
          </button>
        </div>

        {/* Center: Large Windows 11 Shutter Button + Pause Button */}
        <div className="flex flex-col items-center justify-center my-auto gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleShutterClick}
            className={`group relative flex items-center justify-center w-15 h-15 sm:w-18 sm:h-18 rounded-full transition-all duration-200 cursor-pointer shadow-2xl active:scale-90 ${
              isVirtualCamera
                ? 'bg-amber-500/20 text-amber-300 ring-4 ring-amber-500/40 hover:ring-amber-500 hover:bg-amber-500/30'
                : mode === 'photo'
                ? 'bg-white hover:bg-slate-100 ring-4 ring-cyan-400/40 hover:ring-cyan-400'
                : isRecording
                ? 'bg-rose-600 hover:bg-rose-500 ring-4 ring-rose-400 animate-pulse'
                : 'bg-rose-500 hover:bg-rose-400 ring-4 ring-rose-400/40 hover:ring-rose-400'
            }`}
            title={
              isVirtualCamera
                ? 'Virtual Camera (View Only) — Capture & Recording are disabled'
                : mode === 'video'
                ? isRecording
                  ? 'Stop Recording'
                  : 'Start Recording'
                : 'Capture Photo'
            }
          >
            {isVirtualCamera ? (
              <div className="flex flex-col items-center justify-center">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                <span className="text-[8px] sm:text-[9px] font-bold text-amber-200 mt-0.5 uppercase tracking-wider">View</span>
              </div>
            ) : mode === 'video' ? (
              isRecording ? (
                <Square className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white" />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white" />
              )
            ) : (
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-slate-900 group-hover:scale-95 transition-transform" />
            )}
          </button>

          {/* Pause / Resume Button while recording */}
          {mode === 'video' && isRecording && (
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-md transition-all cursor-pointer ${
                isPaused
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold'
                  : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              }`}
              title={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" /> : <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}
        </div>

        {/* Bottom / Right: Recent Media Thumbnail & Gallery */}
        <div className="flex flex-col items-center gap-1 sm:gap-2.5 shrink-0">
          {lastMedia ? (
            <div
              onClick={() => openApp('photos', { filePath: lastMedia.path })}
              className={`group relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden border-2 shadow-md cursor-pointer transition-all hover:scale-105 ${
                isLight ? 'border-slate-400 hover:border-cyan-600' : 'border-white/20 hover:border-cyan-400'
              }`}
              title="Open Recent Capture in Photos"
            >
              {lastMedia.type === 'photo' ? (
                <img
                  src={recentCapturePreview || undefined}
                  alt="Recent Captured Thumbnail"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video
                    src={recentCapturePreview || undefined}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    muted
                    preload="metadata"
                  />
                  <Film className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 relative z-10 drop-shadow" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
            </div>
          ) : (
            <button
              onClick={() => openApp('photos')}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'border-slate-300 bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-50 shadow-sm'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Open Photos Gallery"
            >
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

        </div>
      </div>

      {/* Windows 11 Real Camera Settings Modal */}
      {showSettingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera & Microphone Settings"
          data-testid="camera-settings-overlay"
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center overflow-y-auto p-4"
        >
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5 max-h-full min-h-0 overflow-y-auto border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-xl'
              : 'bg-[#202023] border-white/15 text-white shadow-2xl'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>Camera & Microphone Settings</h3>
                  <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Configure hardware inputs, video quality, and capture preferences</p>
                </div>
              </div>
              <button
                aria-label="Close Camera Settings"
                onClick={() => setShowSettingsModal(false)}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isLight
                    ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'
                    : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Camera Input Device Selection */}
              <div className={`p-3 rounded-xl space-y-2 border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Camera Input Device</p>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Choose active video source</p>
                    </div>
                  </div>
                  <button
                    onClick={() => initCamera(selectedVideoId, selectedAudioId)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-300 font-bold text-[11px] cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
                <select
                  value={selectedVideoId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedVideoId(newId);
                    initCamera(newId, selectedAudioId, facingMode);
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#18181b] border-white/15 text-white'
                  }`}
                >
                  {videoDevices.length > 0 ? (
                    videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} className={isLight ? 'bg-white text-slate-900' : 'bg-[#18181b] text-white'}>
                        {d.label || `Camera ${i + 1} (${d.deviceId.slice(0, 8)}...)`}
                      </option>
                    ))
                  ) : (
                    <option value="" className={isLight ? 'bg-white text-slate-900' : 'bg-[#18181b] text-white'}>Default HD Webcam / Device Camera</option>
                  )}
                </select>

                {/* Front / Back Camera Quick Toggle */}
                <div className={`flex items-center justify-between pt-1 border-t ${
                  isLight ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <span className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Camera Facing Direction:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (facingMode !== 'user') handleSwitchCamera();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        facingMode === 'user'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : isLight
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      Front (Selfie)
                    </button>
                    <button
                      onClick={() => {
                        if (facingMode !== 'environment') handleSwitchCamera();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        facingMode === 'environment'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : isLight
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      Back (Rear)
                    </button>
                  </div>
                </div>
              </div>

              {/* Microphone Device Selection */}
              <div className={`p-3 rounded-xl space-y-2 border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
              }`}>
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Microphone Input Device</p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Audio recording channel for video capture</p>
                  </div>
                </div>
                <select
                  value={selectedAudioId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedAudioId(newId);
                    initCamera(selectedVideoId, newId);
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#18181b] border-white/15 text-white'
                  }`}
                >
                  {audioDevices.length > 0 ? (
                    audioDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} className={isLight ? 'bg-white text-slate-900' : 'bg-[#18181b] text-white'}>
                        {d.label || `Microphone ${i + 1} (${d.deviceId.slice(0, 8)}...)`}
                      </option>
                    ))
                  ) : (
                    <option value="" className={isLight ? 'bg-white text-slate-900' : 'bg-[#18181b] text-white'}>Default Internal Stereo Microphone Array</option>
                  )}
                </select>
              </div>

              {/* Photo Resolution & Aspect Ratio */}
              <div className={`p-3 rounded-xl space-y-2.5 border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
              }`}>
                <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Photo Capture Quality & Framing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[11px] block mb-1 font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Resolution</label>
                    <select
                      value={photoResolution}
                      onChange={(e) => setPhotoResolution(e.target.value as any)}
                      className={`w-full border rounded-lg px-3 py-1.5 text-xs cursor-pointer focus:outline-none focus:border-cyan-500 ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#18181b] border-white/15 text-white'
                      }`}
                    >
                      <option value="1080p">1080p Full HD (1920x1080)</option>
                      <option value="4k">4K Ultra HD (3840x2160)</option>
                      <option value="720p">720p HD (1280x720)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[11px] block mb-1 font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Aspect Ratio</label>
                    <select
                      value={photoRatio}
                      onChange={(e) => setPhotoRatio(e.target.value as any)}
                      className={`w-full border rounded-lg px-3 py-1.5 text-xs cursor-pointer focus:outline-none focus:border-cyan-500 ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#18181b] border-white/15 text-white'
                      }`}
                    >
                      <option value="16:9">16:9 Widescreen</option>
                      <option value="4:3">4:3 Standard</option>
                      <option value="1:1">1:1 Square</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Video Quality */}
              <div className={`p-3 rounded-xl space-y-2 border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
              }`}>
                <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Video Recording Quality</p>
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value as any)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-xs cursor-pointer focus:outline-none focus:border-cyan-500 ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#18181b] border-white/15 text-white'
                  }`}
                >
                  <option value="1080p60">1080p Full HD @ 60 FPS (Smoothest)</option>
                  <option value="1080p30">1080p Full HD @ 30 FPS</option>
                  <option value="720p30">720p HD @ 30 FPS</option>
                </select>
              </div>

              {/* Toggles: Virtual Camera Mode, Mirror, Shutter Sound */}
              <div className="space-y-2.5">
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  <div>
                    <p className={`font-semibold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <span>Virtual Camera Simulation</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-semibold uppercase">View Only</span>
                    </p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>When active, capture and recording are disabled (view-only feed)</p>
                  </div>
                  <button
                    onClick={() => {
                      if (isVirtualCamera) {
                        initCamera();
                      } else {
                        stream?.getTracks().forEach((track) => track.stop());
                        streamRef.current = null;
                        setStream(null);
                        if (videoRef.current) videoRef.current.srcObject = null;
                        setIsVirtualCamera(true);
                      }
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isVirtualCamera ? 'bg-amber-500' : isLight ? 'bg-slate-300' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        isVirtualCamera ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  <div>
                    <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Mirror Front Camera</p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Flip viewfinder and saved images horizontally</p>
                  </div>
                  <button
                    onClick={() => setIsMirrored(!isMirrored)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isMirrored ? 'bg-cyan-500' : isLight ? 'bg-slate-300' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        isMirrored ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  <div>
                    <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Shutter Audio Effect</p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Play audio feedback upon capture</p>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      soundEnabled ? 'bg-cyan-500' : isLight ? 'bg-slate-300' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        soundEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* File Storage Location Section */}
              <div className={`p-3.5 rounded-xl space-y-3.5 border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Custom Save Locations</p>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Select or type directories for captured photos & videos</p>
                    </div>
                  </div>
                </div>

                {/* Photos Save Path */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Photos Destination:</span>
                    <button
                      onClick={() => {
                        setShowSettingsModal(false);
                        openApp('explorer', { path: photoSavePath });
                      }}
                      className="text-cyan-500 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <span>Explore</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={photoSavePath}
                      onChange={(e) => setPhotoSavePath(e.target.value)}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500 ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#18181b] border-white/15 text-white'
                      }`}
                      placeholder={D_DRIVE_FOLDER_PATHS.photoCaptures}
                    />
                  </div>
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                        D_DRIVE_FOLDER_PATHS.photoCaptures,
                        D_DRIVE_FOLDER_PATHS.pictures,
                      D_DRIVE_FOLDER_PATHS.desktop,
                      D_DRIVE_FOLDER_PATHS.downloads,
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setPhotoSavePath(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          photoSavePath === preset
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 font-semibold'
                            : isLight
                            ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-950'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {preset.split('/').pop()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Videos Save Path */}
                <div className={`space-y-1.5 pt-2 border-t ${
                  isLight ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Videos Destination:</span>
                    <button
                      onClick={() => {
                        setShowSettingsModal(false);
                        openApp('explorer', { path: videoSavePath });
                      }}
                      className="text-rose-500 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                    >
                      <span>Explore</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={videoSavePath}
                      onChange={(e) => setVideoSavePath(e.target.value)}
                      className={`flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-rose-500 ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#18181b] border-white/15 text-white'
                      }`}
                      placeholder={D_DRIVE_FOLDER_PATHS.videoCaptures}
                    />
                  </div>
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      D_DRIVE_FOLDER_PATHS.videoCaptures,
                      D_DRIVE_FOLDER_PATHS.videos,
                      D_DRIVE_FOLDER_PATHS.desktop,
                      D_DRIVE_FOLDER_PATHS.downloads,
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setVideoSavePath(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          videoSavePath === preset
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40 font-semibold'
                            : isLight
                            ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-950'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {preset.split('/').pop()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg"
              >
                <Check className="w-4 h-4" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
