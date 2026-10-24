import {
  LayoutDashboard, Map, Users, Bell, LifeBuoy, Settings,
  FileText, UserCog, ClipboardList, FilePlus2,
} from "lucide-react";

export const NAV = {
  citizen: [
    { to: "/citizen", label: "City Health", icon: LayoutDashboard, end: true },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  staff: [
    { to: "/staff", label: "Field Health", icon: LayoutDashboard, end: true },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { to: "/admin", label: "City Health", icon: LayoutDashboard, end: true },
    { to: "/admin/records", label: "Issue Records", icon: FileText },
    { to: "/admin/staff-desk", label: "Staff Desk", icon: UserCog },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
};