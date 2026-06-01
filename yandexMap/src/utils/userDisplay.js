/** Отображаемое имя: никнейм или email. */
export function userDisplayLabel(user, fallback = "Пользователь") {
  if (!user) return fallback;
  const name = String(user.display_name || "").trim();
  if (name) return name;
  return user.email || fallback;
}

/** Буква для аватара-заглушки. */
export function userAvatarLetter(user, fallback = "?") {
  const label = userDisplayLabel(user, "");
  if (label) return label.charAt(0).toUpperCase();
  return fallback;
}
