import { Badge } from "@/components/ui/badge";
import { memberBadgeStyles } from "../utils";

const avatarColors = [
  "from-violet-500 to-purple-600",
  "from-fuchsia-500 to-pink-600",
  "from-purple-500 to-indigo-600",
  "from-violet-400 to-fuchsia-500",
  "from-indigo-500 to-violet-600",
];

export function CustomerAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const colorIndex = name.charCodeAt(0) % avatarColors.length;

  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[colorIndex]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
      {initial}
    </div>
  );
}

export function MemberLevelBadge({ level }: { level: string }) {
  return (
    <Badge className={`${memberBadgeStyles[level]} text-[11px] font-semibold px-2.5 py-0.5`}>
      {level}
    </Badge>
  );
}
