interface PersonAvatarProps {
  name: string;
  avatarUrl: string | null;
  // The initials get the same class with the `--initials` modifier.
  className: string;
}

// "Lenka Husarova" → "LH", "dkolarov" → "DK".
export function initials(name: string) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);

  return letters.toUpperCase();
}

// A person's avatar, or their initials when `avatar_url` is null (the default avatar, §8.2).
// Decorative: the name is always shown next to it.
function PersonAvatar({ name, avatarUrl, className }: PersonAvatarProps) {
  if (avatarUrl) {
    return <img className={className} src={avatarUrl} alt="" />;
  }

  return (
    <span className={`${className} ${className}--initials`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export default PersonAvatar;
