export function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let prefix = 'Guten Tag';
  if (hour < 11) prefix = 'Guten Morgen';
  else if (hour < 17) prefix = 'Guten Nachmittag';
  else if (hour >= 17) prefix = 'Guten Abend';
  return `${prefix}, ${name}`;
}
