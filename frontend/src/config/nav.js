import {
  Building2, Contact, HeartPulse, Flag, MapPin, Map as MapIcon,
  ClipboardCheck, Shield, UserCog, LifeBuoy, Settings, Bell, Users,
} from "lucide-react";

// One sidebar per desk. Notifications carries the unread count (badge: "inbox").
// Community: every desk (citizen board, Community Command, field zone board).
// Issue pages that are not listed here (My Reports,
// Saved, Operations, City Intake, Field Load, All Issues, Assign, Staff
// Management, Analytics, Service Windows, Audit Log) open from the Issue Management lane
// rail at the top of every issue page (IssueShell.jsx). Their sidebar item
// stays lit while you are on them ("also").
export const NAV = {
  citizen: [
    { to: "/citizen", label: "City Health", icon: Building2, end: true },
    { to: "/citizen/report", label: "Report Issue", icon: Flag, also: ["/citizen/my-reports", "/citizen/saved", "/citizen/issues"] },
    { to: "/map", label: "Map", icon: MapPin },
    { to: "/community", label: "Community", icon: Users },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: "inbox" },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  staff: [
    { to: "/staff", label: "Field Health", icon: Contact, end: true },
    { to: "/map", label: "Map", icon: MapPin },
    { to: "/staff/assigned", label: "Assigned Work", icon: ClipboardCheck, also: ["/staff/issues", "/staff/queue", "/staff/operations", "/staff/performance"] },
    { to: "/community", label: "Community", icon: Users },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: "inbox" },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { to: "/admin", label: "City Health", icon: HeartPulse, end: true },
    { to: "/map", label: "Map", icon: MapIcon },
    { to: "/community", label: "Community", icon: Users },
    { to: "/admin/command", label: "Issue Command", icon: Shield, also: ["/admin/queue", "/admin/assignments", "/admin/staff", "/admin/analytics", "/admin/windows", "/admin/audit", "/admin/issues"] },
    { to: "/admin/staff-desk", label: "Staff Desk", icon: UserCog },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: "inbox" },
    { to: "/help", label: "Help", icon: LifeBuoy },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
};