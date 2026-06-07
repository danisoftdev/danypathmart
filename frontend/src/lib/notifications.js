import { useAuthStore } from '../store/authStore';
import { isAdminUser } from '../lib/permissions';
import api from '../lib/api';

export function canUseNotifications(user) {
  if (!user) return false;
  return user.role === 'customer' || isAdminUser(user);
}

export function notificationPollMs(user) {
  return isAdminUser(user) ? 15_000 : 60_000;
}
