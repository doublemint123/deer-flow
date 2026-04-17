"use client";

import {
  BellRing,
  BookOpen,
  BotIcon,
  History,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Server,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";

const opsNavItems = [
  { key: "dashboard" as const, icon: LayoutDashboard, agent: "ops-dashboard" },
  { key: "alerts" as const, icon: BellRing, agent: "alert-board" },
  { key: "devices" as const, icon: Server, agent: "device-management" },
  { key: "knowledge" as const, icon: BookOpen, agent: "knowledge-base" },
  { key: "diagnosis" as const, icon: History, agent: "diagnosis-history" },
  { key: "probe" as const, icon: Network, agent: "network-probe" },
];

export function WorkspaceNavChatList() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive={pathname === "/workspace/chats"} asChild>
            <Link className="text-muted-foreground" href="/workspace/chats">
              <MessagesSquare />
              <span>{t.sidebar.chats}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/agents")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/agents">
              <BotIcon />
              <span>{t.sidebar.agents}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarSeparator className="my-2" />
      <SidebarGroupLabel>{t.sidebar.opsNav}</SidebarGroupLabel>
      <SidebarMenu>
        {opsNavItems.map((item) => (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton
              isActive={pathname.includes(`/agents/${item.agent}/`)}
              asChild
            >
              <Link
                className="text-muted-foreground"
                href={`/workspace/agents/${item.agent}/chats/new`}
              >
                <item.icon size={16} />
                <span>{t.sidebar.ops[item.key]}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
