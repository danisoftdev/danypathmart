import { resolveImageUrl } from './currency';
import { isAdminUser } from './permissions';

/** Official DanyPathMart logo — served from /public/brand/logo.png */
export const SITE_LOGO_SRC = '/brand/logo.png';

/** Profile image for a user. Admins and users without a photo get the site logo. */
export function userProfilePhotoSrc(user) {
  if (!user || isAdminUser(user)) return SITE_LOGO_SRC;
  if (user.profile_photo) return resolveImageUrl(user.profile_photo);
  return SITE_LOGO_SRC;
}

export function canChangeProfilePhoto(user) {
  return !!user && !isAdminUser(user);
}

export function isUsingSiteLogo(user) {
  if (!user || isAdminUser(user)) return true;
  return !user.profile_photo;
}
