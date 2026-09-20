import { useSyncExternalStore } from "react";

const seed = [
  {
    id: "ISS-2401",
    title: "Broken streetlight near Central Park",
    description:
      "The streetlight has been non-functional for the past week. The area is unsafe after sunset.",
    category: "lighting",
    location: "Sector 12, Main Road",
    ward: "Kothrud",
    lat: 18.5074,
    lng: 73.8077,
    photos: [],
    reportedBy: "Aanya Mehra",
    reporterId: "citizen-1",
    status: "in_progress",
    priority: "high",
    assignedTo: "Rohan Desai",
    comments: [],
    timeline: [
      { status: "submitted", at: "2026-09-12T08:10:00.000Z", by: "Aanya Mehra" },
      { status: "acknowledged", at: "2026-09-12T14:40:00.000Z", by: "Priya Shah" },
      { status: "in_progress", at: "2026-09-15T09:10:00.000Z", by: "Rohan Desai" },
    ],
    createdAt: "2026-09-12T08:10:00.000Z",
    updatedAt: "2026-09-15T09:20:00.000Z",
    saved: true,
    slaHours: 48,
  },
  {
    id: "ISS-2398",
    title: "Water leakage on 3rd Avenue",
    description: "A broken municipal pipe is flooding the footpath.",
    category: "water",
    location: "Near City Mall",
    ward: "Aundh",
    lat: 18.559,
    lng: 73.807,
    photos: [],
    reportedBy: "Aanya Mehra",
    reporterId: "citizen-1",
    status: "acknowledged",
    priority: "critical",
    assignedTo: "Meera Kulkarni",
    comments: [],
    timeline: [
      { status: "submitted", at: "2026-09-10T11:00:00.000Z", by: "Aanya Mehra" },
      { status: "acknowledged", at: "2026-09-11T08:15:00.000Z", by: "Priya Shah" },
    ],
    createdAt: "2026-09-10T11:00:00.000Z",
    updatedAt: "2026-09-11T08:15:00.000Z",
    saved: false,
    slaHours: 24,
  },
  {
    id: "ISS-2385",
    title: "Garbage pile-up behind market",
    description: "Uncollected waste has been accumulating for several days.",
    category: "waste",
    location: "Old Market Lane",
    ward: "Shivajinagar",
    lat: 18.5308,
    lng: 73.847,
    photos: [],
    reportedBy: "Aanya Mehra",
    reporterId: "citizen-1",
    status: "resolved",
    priority: "medium",
    assignedTo: "Sana Qureshi",
    comments: [],
    timeline: [
      { status: "submitted", at: "2026-09-05T07:30:00.000Z", by: "Aanya Mehra" },
      { status: "acknowledged", at: "2026-09-05T12:00:00.000Z", by: "Priya Shah" },
      { status: "in_progress", at: "2026-09-08T09:00:00.000Z", by: "Sana Qureshi" },
      { status: "resolved", at: "2026-09-14T16:00:00.000Z", by: "Sana Qureshi" },
    ],
    createdAt: "2026-09-05T07:30:00.000Z",
    updatedAt: "2026-09-14T16:00:00.000Z",
    saved: false,
    slaHours: 72,
  },
  {
    id: "ISS-2410",
    title: "Pothole cluster on Baner Main",
    description: "Five deep potholes are slowing peak-hour traffic.",
    category: "roads",
    location: "Baner Main Road",
    ward: "Baner",
    lat: 18.5596,
    lng: 73.7794,
    photos: [],
    reportedBy: "Vikram Joshi",
    reporterId: "citizen-2",
    status: "submitted",
    priority: "high",
    assignedTo: null,
    comments: [],
    timeline: [
      { status: "submitted", at: "2026-09-16T18:40:00.000Z", by: "Vikram Joshi" },
    ],
    createdAt: "2026-09-16T18:40:00.000Z",
    updatedAt: "2026-09-16T18:40:00.000Z",
    saved: false,
    slaHours: 36,
  },
];

let issues = seed;
let audit = [
  {
    id: "a1",
    at: "2026-09-15T09:10:00.000Z",
    actor: "Rohan Desai",
    role: "staff",
    action: "Moved ISS-2401 to In Progress",
    issueId: "ISS-2401",
  },
];
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getIssues() {
  return issues;
}

export function getAudit() {
  return audit;
}

export function nextIssueId() {
  const nums = issues.map((i) => Number(i.id.replace("ISS-", ""))).filter(Boolean);
  return `ISS-${(nums.length ? Math.max(...nums) : 2400) + 1}`;
}

export function addIssue(issue) {
  issues = [issue, ...issues];
  audit = [
    {
      id: uid("a"),
      at: now(),
      actor: issue.reportedBy,
      role: "citizen",
      action: `Filed ${issue.id}`,
      issueId: issue.id,
    },
    ...audit,
  ];
  emit();
}

export function updateStatus(id, status, by) {
  issues = issues.map((issue) =>
    issue.id !== id
      ? issue
      : {
          ...issue,
          status,
          updatedAt: now(),
          timeline: [...issue.timeline, { status, at: now(), by }],
        }
  );
  audit = [
    { id: uid("a"), at: now(), actor: by, role: "staff", action: `Moved ${id} to ${status}`, issueId: id },
    ...audit,
  ];
  emit();
}

export function assignIssue(id, staffName, by) {
  issues = issues.map((issue) =>
    issue.id !== id
      ? issue
      : {
          ...issue,
          assignedTo: staffName || null,
          updatedAt: now(),
          status: issue.status === "submitted" && staffName ? "acknowledged" : issue.status,
          timeline:
            issue.status === "submitted" && staffName
              ? [...issue.timeline, { status: "acknowledged", at: now(), by, note: `Assigned to ${staffName}` }]
              : issue.timeline,
        }
  );
  audit = [
    {
      id: uid("a"),
      at: now(),
      actor: by,
      role: "admin",
      action: staffName ? `Assigned ${id} to ${staffName}` : `Unassigned ${id}`,
      issueId: id,
    },
    ...audit,
  ];
  emit();
}

export function setPriority(id, priority, by) {
  issues = issues.map((issue) =>
    issue.id !== id ? issue : { ...issue, priority, updatedAt: now() }
  );
  audit = [
    { id: uid("a"), at: now(), actor: by, role: "admin", action: `Set ${id} priority to ${priority}`, issueId: id },
    ...audit,
  ];
  emit();
}

export function toggleSaved(id) {
  issues = issues.map((issue) =>
    issue.id !== id ? issue : { ...issue, saved: !issue.saved }
  );
  emit();
}

export function addComment(id, body, author, role, internal = false) {
  issues = issues.map((issue) =>
    issue.id !== id
      ? issue
      : {
          ...issue,
          updatedAt: now(),
          comments: [
            ...issue.comments,
            { id: uid("c"), author, role, body, createdAt: now(), internal },
          ],
        }
  );
  emit();
}

export function useIssues() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getIssues,
    getIssues
  );
}

export function useAudit() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getAudit,
    getAudit
  );
}