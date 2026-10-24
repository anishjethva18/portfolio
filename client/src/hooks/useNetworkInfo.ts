import { useState, useEffect, useCallback } from 'react';

export interface NetworkConnectionDetails {
  isOnline: boolean;
  networkName: string;
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * Custom hook to query and observe real-time network connection info from
 * the browser's Network Information API (navigator.connection).
 */
export function useNetworkInfo(): NetworkConnectionDetails {
  const getNetworkDetails = useCallback((): NetworkConnectionDetails => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { isOnline: true, networkName: 'Wi-Fi' };
    }

    const isOnline = navigator.onLine !== false;
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (!isOnline) {
      return {
        isOnline: false,
        networkName: 'No Internet',
      };
    }

    const networkName = 'Connected';

    return {
      isOnline,
      networkName,
      effectiveType: conn?.effectiveType,
      type: conn?.type,
      downlink: conn?.downlink,
      rtt: conn?.rtt,
      saveData: conn?.saveData,
    };
  }, []);

  const [networkInfo, setNetworkInfo] = useState<NetworkConnectionDetails>(getNetworkDetails);

  useEffect(() => {
    const handleUpdate = () => {
      setNetworkInfo(getNetworkDetails());
    };

    window.addEventListener('online', handleUpdate);
    window.addEventListener('offline', handleUpdate);

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleUpdate);
    }

    return () => {
      window.removeEventListener('online', handleUpdate);
      window.removeEventListener('offline', handleUpdate);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleUpdate);
      }
    };
  }, [getNetworkDetails]);

  return networkInfo;
}
