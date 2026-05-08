type IconProps = { size?: number; color?: string; strokeWidth?: number };
const base = (size: number, sw: number) => ({ width: size, height: size, viewBox: '0 0 20 20', fill: 'none' as const, stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Icons = {
  Zap: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><polyline points="13 2 7 11 10 11 7 18 13 9 10 9 13 2" /></svg>
  ),
  Monitor: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><rect x="2" y="3" width="16" height="11" rx="2" /><line x1="7" y1="18" x2="13" y2="18" /><line x1="10" y1="14" x2="10" y2="18" /></svg>
  ),
  Clipboard: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><path d="M12 2H8a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2V3a1 1 0 0 0-1-1z" /><line x1="8" y1="10" x2="12" y2="10" /><line x1="8" y1="13" x2="12" y2="13" /></svg>
  ),
  Layout: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><rect x="2" y="2" width="16" height="16" rx="2" /><line x1="2" y1="7" x2="18" y2="7" /><line x1="8" y1="7" x2="8" y2="18" /></svg>
  ),
  Check: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><polyline points="4 10 8 14 16 6" /></svg>
  ),
  ArrowRight: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><line x1="4" y1="10" x2="16" y2="10" /><polyline points="11 5 16 10 11 15" /></svg>
  ),
  Terminal: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><polyline points="4 7 8 10 4 13" /><line x1="10" y1="13" x2="16" y2="13" /></svg>
  ),
  Cloud: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><path d="M16 14a4 4 0 0 0-4-7.5A5 5 0 0 0 4 11a3 3 0 0 0 0 6h12a3 3 0 0 0 0-6z" /></svg>
  ),
  Lock: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><rect x="5" y="9" width="10" height="9" rx="2" /><path d="M7 9V6a3 3 0 0 1 6 0v3" /></svg>
  ),
  Mobile: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><rect x="6" y="1" width="8" height="18" rx="2" /><line x1="10" y1="16" x2="10" y2="16" strokeWidth="2" /></svg>
  ),
  Code: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><polyline points="4 6 2 10 4 14" /><polyline points="16 6 18 10 16 14" /><line x1="9" y1="3" x2="11" y2="17" /></svg>
  ),
  MessageCircle: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><path d="M4 2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2z" /></svg>
  ),
  Globe: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><circle cx="10" cy="10" r="8" /><line x1="2" y1="10" x2="18" y2="10" /><path d="M10 2a12 12 0 0 1 0 16" /><path d="M10 2a12 12 0 0 0 0 16" /></svg>
  ),
  GitBranch: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><line x1="6" y1="4" x2="6" y2="13" /><circle cx="6" cy="3" r="1.5" /><circle cx="6" cy="16" r="1.5" /><circle cx="15" cy="6" r="1.5" /><path d="M6 5a5 5 0 0 0 9 4" /></svg>
  ),
  Bell: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><path d="M10 2a6 6 0 0 1 6 6v3l2 3H2l2-3V8a6 6 0 0 1 6-6z" /><path d="M8.5 17a1.5 1.5 0 0 0 3 0" /></svg>
  ),
  Triangle: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><polygon points="10 2 18 18 2 18" /></svg>
  ),
  Gift: ({ size = 20, strokeWidth = 1.5 }: IconProps) => (
    <svg {...base(size, strokeWidth)}><rect x="2" y="8" width="16" height="10" rx="2" /><path d="M2 10h16M10 8V18" /><path d="M10 8C10 5 7 3 5.5 5S7 8 10 8" /><path d="M10 8C10 5 13 3 14.5 5S13 8 10 8" /></svg>
  ),
};
