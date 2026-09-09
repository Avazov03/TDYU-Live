const ICONS: Record<string, string> = {
  home: '<path d="M3 9.5l9-7 9 7"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  shorts:
    '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  search:
    '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 6.5-3 8.5-3 8.5h18s-3-2-3-8.5"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  moon: '<path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 6.8 6.8 0 0 0 20 13.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  clock:
    '<circle cx="12" cy="12" r="9.5"/><polyline points="12 7 12 12 16 14.5"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 8 8 8"/><path d="M12 7v5l3.5 2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  list: '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  bookmark:
    '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  thumbup:
    '<path d="M7 22V11l5-9 1.5 1.5L12 9h7.5a2 2 0 0 1 2 2.3l-1.5 9a2 2 0 0 1-2 1.7H10a3 3 0 0 1-3-3z"/><path d="M7 11H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3"/>',
  thumbdown:
    '<path d="M17 2v11l-5 9-1.5-1.5L12 15H4.5a2 2 0 0 1-2-2.3l1.5-9a2 2 0 0 1 2-1.7H14a3 3 0 0 1 3 3z"/><path d="M17 13h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4.7a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.3 2.7a7.5 7.5 0 0 0-1.7 1L6.6 6 4.6 9.5 6.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-.7a7.5 7.5 0 0 0 1.7 1L11 21h4l.3-2.7a7.5 7.5 0 0 0 1.7-1l2.4.7 2-3.5z"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 1 1 4.3 2.2c-1 .7-1.6 1.1-1.6 2.3"/><line x1="12" y1="17" x2="12" y2="17.1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="15 17 20 12 15 7"/><line x1="20" y1="12" x2="9" y2="12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  copy:
    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:
    '<path d="M17.9 17.9A10.7 10.7 0 0 1 12 19.5C7 19.5 2.7 16 1 12c.8-1.8 2.1-3.4 3.7-4.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="1" y1="1" x2="23" y2="23"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  refresh:
    '<polyline points="23 4 23 10 17 10"/><path d="M20.5 13A8.5 8.5 0 1 1 19 6.3L23 10"/>',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  msquare:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/>',
};

type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }}
    />
  );
}
