import { PORTFOLIO_USER } from '../data/portfolioData';
import type { NotificationItem } from '../types';
import { formatTime } from './dateTime';

export const WELCOME_NOTIFICATION_SHOWN_KEY = 'win11_welcome_notification_shown_v1';

export interface NotificationPolicyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const shouldShowWelcomeNotification = (storage: NotificationPolicyStorage): boolean => {
  try {
    return storage.getItem(WELCOME_NOTIFICATION_SHOWN_KEY) !== 'true';
  } catch (error) {
    console.error('[Notifications] Could not check welcome notification history.', error);
    return true;
  }
};

export const markWelcomeNotificationShown = (storage: NotificationPolicyStorage): void => {
  try {
    storage.setItem(WELCOME_NOTIFICATION_SHOWN_KEY, 'true');
  } catch (error) {
    console.error('[Notifications] Could not save welcome notification history.', error);
  }
};

export const createWelcomeNotification = (): NotificationItem => ({
  id: 'welcome-1',
  title: 'Welcome to Windows 11 Portfolio',
  message: `Explore ${PORTFOLIO_USER.name}'s interactive OS! Double-click icons or use the Start menu.`,
  timestamp: formatTime(new Date(), { hour: '2-digit', minute: '2-digit' }),
  type: 'info',
  read: false,
});

export const getInitialNotifications = (
  storage: NotificationPolicyStorage,
): NotificationItem[] => (
  shouldShowWelcomeNotification(storage) ? [createWelcomeNotification()] : []
);
