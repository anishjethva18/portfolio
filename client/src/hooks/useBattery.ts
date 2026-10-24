import { useState, useEffect } from 'react';

export interface BatteryState {
  supported: boolean;
  level: number | null; // 0 - 100
  isCharging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
  chargingStatusText: string;
}

export function useBattery(): BatteryState {
  const [batteryState, setBatteryState] = useState<BatteryState>({
    supported: false,
    level: null,
    isCharging: false,
    chargingTime: null,
    dischargingTime: null,
    chargingStatusText: 'Unavailable',
  });

  useEffect(() => {
    let mounted = true;
    let batteryObj: any = null;

    const handleBatteryUpdate = () => {
      if (!mounted || !batteryObj) return;

      const level = Math.round(batteryObj.level * 100);
      const isCharging = Boolean(batteryObj.charging);
      const chargingTime = batteryObj.chargingTime;
      const dischargingTime = batteryObj.dischargingTime;

      let statusText = isCharging ? 'Plugged in' : 'Discharging';
      if (level >= 100 && isCharging) {
        statusText = 'Fully Charged';
      } else if (level <= 15 && !isCharging) {
        statusText = 'Low Battery';
      }

      setBatteryState({
        supported: true,
        level,
        isCharging,
        chargingTime,
        dischargingTime,
        chargingStatusText: statusText,
      });
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((b: any) => {
          if (!mounted) return;
          batteryObj = b;
          handleBatteryUpdate();

          batteryObj.addEventListener('levelchange', handleBatteryUpdate);
          batteryObj.addEventListener('chargingchange', handleBatteryUpdate);
          batteryObj.addEventListener('chargingtimechange', handleBatteryUpdate);
          batteryObj.addEventListener('dischargingtimechange', handleBatteryUpdate);
        })
        .catch(() => {
          if (mounted) {
            setBatteryState({
              supported: false,
              level: null,
              isCharging: false,
              chargingTime: null,
              dischargingTime: null,
              chargingStatusText: 'Battery Info Unavailable',
            });
          }
        });
    } else {
      setBatteryState({
        supported: false,
        level: null,
        isCharging: false,
        chargingTime: null,
        dischargingTime: null,
        chargingStatusText: 'Battery API Not Supported',
      });
    }

    return () => {
      mounted = false;
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', handleBatteryUpdate);
          batteryObj.removeEventListener('chargingchange', handleBatteryUpdate);
          batteryObj.removeEventListener('chargingtimechange', handleBatteryUpdate);
          batteryObj.removeEventListener('dischargingtimechange', handleBatteryUpdate);
        } catch {}
      }
    };
  }, []);

  return batteryState;
}
