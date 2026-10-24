import { LayoutDashboard, Map, FilePlus2, Users, Bell, LifeBuoy, Settings, ClipboardList, FileText, UserCog } from "lucide-react";

export const NAV = {
  citizen: [
    { to: "/citizen", label: "City Health", icon: LayoutDashboard, end: true },
    { to: "/citizen/report", label: "Report Issue", icon: FilePlus2 },
    { to: "/citizen/map", label: "Map", icon: Map },
    { to: "/citizen/community", label: "Community", icon: Users },
    { to: "/citizen/notifications", label: "Notifications", icon: Bell },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  staff: [
    { to: "/staff", label: "Field Health", icon: LayoutDashboard, end: true },
    { to: "/staff/map", label: "Map", icon: Map },
    { to: "/staff/assigned", label: "Assigned Work", icon: ClipboardList },
    { to: "/staff/notifications", label: "Notifications", icon: Bell },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { to: "/admin", label: "City Health", icon: LayoutDashboard, end: true },
    { to: "/admin/map", label: "Map", icon: Map },
    { to: "/admin/community", label: "Community", icon: Users },
    { to: "/admin/records", label: "Issue Records", icon: FileText },
    { to: "/admin/staff-desk", label: "Staff Desk", icon: UserCog },
    { to: "/admin/notifications", label: "Notifications", icon: Bell },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
};