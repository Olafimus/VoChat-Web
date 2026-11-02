/**
 * Alle Symbole der App an einer Stelle – einheitlich aus Lucide (gleiche Strichstärke, gleiche Ecken).
 * Eigene Symbole im selben Stil (24er-Raster, 2px Strich, runde Enden) stehen unten.
 */
import type { LucideProps } from "lucide-react";
export {
  House as IconHome,
  MessagesSquare as IconChats,
  BookOpenText as IconVocab,
  Brain as IconLearn,
  Map as IconPaths,
  UsersRound as IconCommunity,
  CircleUserRound as IconProfile,
  ScanText as IconScan,
  ChartColumnBig as IconStats,
  Volume2 as IconSpeak,
  VolumeX as IconMute,
  Mic as IconMic,
  Square as IconStop,
  Play as IconPlay,
  Pause as IconPause,
  SendHorizontal as IconSend,
  Paperclip as IconAttach,
  Smile as IconEmoji,
  Ellipsis as IconMore,
  Check as IconCheck,
  CheckCheck as IconCheckCheck,
  Clock3 as IconClock,
  TriangleAlert as IconAlert,
  ArrowLeft as IconBack,
  ArrowDown as IconDown,
  X as IconClose,
  Plus as IconPlus,
  Pencil as IconEdit,
  Trash2 as IconTrash,
  Reply as IconReply,
  Copy as IconCopy,
  Sparkles as IconSparkles,
  Flame as IconFlame,
  Target as IconTarget,
  ShieldCheck as IconShield,
  TrendingUp as IconTrend,
  CalendarDays as IconCalendar,
  Trophy as IconTrophy,
  Bell as IconBell,
  Download as IconInstall,
  Camera as IconCamera,
  ImagePlus as IconImage,
  Star as IconStar,
  EyeOff as IconIgnore,
  RotateCcw as IconReset,
  Pin as IconPin,
  Languages as IconLanguages,
  BookA as IconDictionary,
  Search as IconSearch,
  Settings2 as IconSettings,
  Info as IconInfo,
  Lightbulb as IconWhy,
  Gauge as IconGauge,
  Timer as IconTimer,
  ListChecks as IconChecklist,
  UserPlus as IconAddFriend,
  Users as IconGroup,
  CircleCheckBig as IconDone,
  Upload as IconUpload,
  NotebookPen as IconNotes,
  Link2 as IconLink,
} from "lucide-react";

/** Serie/Streak-Symbol im Lucide-Stil: Flamme mit Häkchen. */
export function IconStreak({ size = 24, strokeWidth = 2, ...rest }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="lucide" aria-hidden {...rest}>
      <path d="M12 3c.5 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2-4 .2 1.5 1 2.5 2 2.5 0-3-1-5 .5-8Z" />
      <path d="m9.5 15 1.8 1.8L14.8 13" />
    </svg>
  );
}

/** Karteikarte im Lucide-Stil (zwei versetzte Karten). */
export function IconCards({ size = 24, strokeWidth = 2, ...rest }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="lucide" aria-hidden {...rest}>
      <rect x="3" y="7" width="13" height="14" rx="2.5" />
      <path d="M8 3h10.5A2.5 2.5 0 0 1 21 5.5V16" />
      <path d="M7 12h5M7 15.5h3" />
    </svg>
  );
}
