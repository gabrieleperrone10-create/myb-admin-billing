import { ListTodo, Phone, Mail, MessageCircle, Users } from "lucide-react";
import type { TaskType } from "@prisma/client";

const ICONS: Record<TaskType, typeof ListTodo> = {
  TODO: ListTodo,
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Users,
};

export function TaskTypeIcon({ type, className, style }: { type: TaskType; className?: string; style?: React.CSSProperties }) {
  const Icon = ICONS[type];
  return <Icon className={className ?? "w-3.5 h-3.5"} style={style} />;
}
