// Onboarding icon set — maps the mockup _sprite.svg ids to lucide-react
// equivalents. Local to the /welcome flow; no global sprite asset shipped.
import {
  ArrowLeft, ArrowRight, Bell, Zap, CreditCard, BarChart3, MessageSquare,
  Check, Code, Cpu, Eye, EyeOff, Folder, Github, Globe, Link2, Plus, Search,
  Shield, Sparkles, Triangle,
} from 'lucide-react';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

type IconProps = { size?: number; className?: string; strokeWidth?: number };

const wrap = (
  Comp: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>,
  defaultStroke = 1.75,
) =>
  function Icon({ size = 16, className, strokeWidth = defaultStroke }: IconProps) {
    return <Comp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
  };

export const IArrowL = wrap(ArrowLeft);
export const IArrowR = wrap(ArrowRight);
export const IBell = wrap(Bell);
export const IBolt = wrap(Zap);
export const ICard = wrap(CreditCard);
export const IChart = wrap(BarChart3);
export const IChat = wrap(MessageSquare);
export const ICheck = wrap(Check, 2.25);
export const ICode = wrap(Code);
export const ICpu = wrap(Cpu);
export const IEye = wrap(Eye);
export const IEyeOff = wrap(EyeOff);
export const IFolder = wrap(Folder);
export const IGithub = wrap(Github);
export const IGlobe = wrap(Globe);
export const ILink = wrap(Link2);
export const IPlus = wrap(Plus);
export const ISearch = wrap(Search);
export const IShield = wrap(Shield);
export const ISpark = wrap(Sparkles);
// Vercel mark approximation — lucide has no Vercel glyph
export const IVercel = wrap(Triangle, 2);

// Goblin mark — reuse existing brand component
export function GMark({ size = 22, className }: { size?: number; className?: string }) {
  return <GoblinLogo state="idle" size={size} variant="gold" className={className} />;
}
