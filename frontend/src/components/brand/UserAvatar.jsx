import { isUsingSiteLogo, userProfilePhotoSrc } from '../../lib/brand';
import { LOGO_FRAME } from './SiteLogo';

export default function UserAvatar({
  user,
  className = 'h-10 w-10',
  imgClassName,
}) {
  const siteLogo = isUsingSiteLogo(user);
  const resolvedImgClass = imgClassName ?? (siteLogo ? 'object-contain' : 'object-cover');

  if (siteLogo) {
    return (
      <div className={`${LOGO_FRAME} ${className}`}>
        <img
          src={userProfilePhotoSrc(user)}
          alt=""
          className={`h-full w-full ${resolvedImgClass}`}
        />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-full bg-white ring-1 ring-black/5 dark:ring-white/10 ${className}`}>
      <img
        src={userProfilePhotoSrc(user)}
        alt=""
        className={`h-full w-full ${resolvedImgClass}`}
      />
    </div>
  );
}
