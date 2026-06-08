'use client';

import {
  Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Search, Settings, Menu, MoreHorizontal, ArrowRight, ArrowLeft,
  Key, FileCode, Folder, FileText, MessageSquare, Image as ImageIcon,
  Pin, Pencil, Link2, Archive, Trash2, Download, Upload,
  Check, AlertCircle, Info, Zap, Shield, CircleHelp,
  Github, Cpu, Globe, Mic, Send, Sparkles, CreditCard,
  Building2, Server, Boxes, BarChart3, Bell, LogOut, User,
  Eye, EyeOff, Copy, ExternalLink, RefreshCw, Play,
  Sun, Moon, Monitor, Smartphone, Laptop, Mail, BellOff,
  PartyPopper, Wrench, Rocket, MessageCircle, Hash,
  Save, Keyboard, Undo, Redo, IndentIncrease, IndentDecrease,
  Lightbulb, Layout,
} from 'lucide-react';

export const Icons = {
  add: Plus,
  close: X,
  back: ChevronLeft,
  forward: ChevronRight,
  expand: ChevronDown,
  collapse: ChevronUp,
  search: Search,
  settings: Settings,
  menu: Menu,
  more: MoreHorizontal,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  check: Check,
  copy: Copy,
  externalLink: ExternalLink,
  refresh: RefreshCw,
  play: Play,
  eye: Eye,
  eyeOff: EyeOff,

  apiKey: Key,
  code: FileCode,
  project: Folder,
  document: FileText,
  chat: MessageSquare,
  chatCircle: MessageCircle,
  image: ImageIcon,
  model: Cpu,
  provider: Server,
  usage: BarChart3,
  billing: CreditCard,
  storage: Boxes,
  notification: Bell,
  notificationOff: BellOff,
  user: User,
  logout: LogOut,
  github: Github,
  web: Globe,
  mic: Mic,
  send: Send,
  ai: Sparkles,
  company: Building2,
  mail: Mail,

  pin: Pin,
  rename: Pencil,
  share: Link2,
  archive: Archive,
  delete: Trash2,
  download: Download,
  upload: Upload,

  error: AlertCircle,
  info: Info,
  help: CircleHelp,
  security: Shield,
  fast: Zap,

  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  smartphone: Smartphone,
  laptop: Laptop,

  celebrate: PartyPopper,
  tool: Wrench,
  rocket: Rocket,
  idea: Lightbulb,
  layout: Layout,

  hash: Hash,
  save: Save,
  keyboard: Keyboard,
  undo: Undo,
  redo: Redo,
  indentIn: IndentIncrease,
  indentOut: IndentDecrease,
} as const;

export type IconName = keyof typeof Icons;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 1.75,
  className,
  style,
  'aria-label': ariaLabel,
}: IconProps) {
  const C = Icons[name];
  return (
    <C
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? 'currentColor'}
      className={className}
      // WALKFIX-4.1: SVGs default to vertical-align:baseline → an inline glyph (e.g.
      // the </> code chip) sits a few px below the text baseline, looking misaligned.
      // `middle` centres it on the text x-height. Ignored inside flex/grid rows (so
      // existing centred chips are unaffected), corrects the inline cases.
      style={{ verticalAlign: 'middle', ...style }}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  );
}
