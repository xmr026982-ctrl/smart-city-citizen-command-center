/* ------------------------------------------------------------------
   Help content, one set per desk. Every step describes what the app
   does today (checked against the pages, not written from memory); when
   a page changes, change its topic here in the same commit.

   TOPICS[i]:
     id      also the address: /help?topic=<id>
     group   "desk" (this desk's work) · "shared" (every desk) · "account"
     to      the page the "Open" button goes to, per role
     copy    per role: lead (one line), steps (in order), tip (optional)
   QUICK: the "Start here" cards per role, each opens a topic.
   No names of real people live here: the app shows them from the roster.
------------------------------------------------------------------- */

/* Where a report is, in the words each desk sees. Citizens never see
   "Pending confirmation": it reads In Progress until command confirms. */
export const STATUS = {
  citizen: [
    { id: "submitted", label: "Submitted", note: "Filed. The city has it." },
    { id: "acknowledged", label: "Acknowledged", note: "Seen and queued for a crew." },
    { id: "in_progress", label: "In Progress", note: "A crew is on it, until command confirms the fix." },
    { id: "resolved", label: "Resolved", note: "Command confirmed the work is done." },
  ],
  staff: [
    { id: "acknowledged", label: "Acknowledged", note: "On you. Start when you're on site." },
    { id: "in_progress", label: "In Progress", note: "You're working on it." },
    { id: "pending_review", label: "Pending confirmation", note: "You asked to close it. Command decides." },
    { id: "resolved", label: "Resolved", note: "Command confirmed. It moves to Field Load." },
  ],
  admin: [
    { id: "submitted", label: "Submitted", note: "Filed by a citizen. Needs an owner." },
    { id: "acknowledged", label: "Acknowledged", note: "Dispatched to a crew." },
    { id: "in_progress", label: "In Progress", note: "The crew started work." },
    { id: "pending_review", label: "Pending confirmation", note: "The crew asked to close. Confirm or send back." },
    { id: "resolved", label: "Resolved", note: "Confirmed by command." },
  ],
};

export const GROUPS = { desk: "Your desk", shared: "Every desk", account: "Your account" };

export const TOPICS = [
  /* ---------------- citizen ---------------- */
  {
    id: "city", group: "desk", roles: ["citizen", "admin"], title: "City Health",
    to: { citizen: "/citizen", admin: "/admin" },
    copy: {
      citizen: {
        lead: "Live readings for one zone: air, traffic, water and power.",
        steps: [
          "The zone in the top bar decides which zone you see. Pick another there.",
          "Readings refresh on their own. The SYNCED light in the top bar shows the desk is live.",
          "The small line under a reading is its recent history, not a forecast.",
          "The model follows the real sky over Kolkata: the day city after sunrise, the lit night city after dusk. The sun button beside the model switches between Live sky, Day and Night.",
          "Something broken in the street? That's a report, not a reading: use Report Issue.",
        ],
      },
      admin: {
        lead: "The command view of one zone's readings.",
        steps: [
          "The zone in the top bar decides which zone you see. Pick another there.",
          "Readings refresh on their own. The SYNCED light in the top bar shows the desk is live.",
          "A spike is a signal, not a file. The files themselves are in Issue Command.",
          "The model follows the real sky over Kolkata: the day city after sunrise, the lit night city after dusk. The sun button beside the model switches between Live sky, Day and Night.",
        ],
      },
    },
  },
  {
    id: "report", group: "desk", roles: ["citizen"], title: "Report an issue",
    to: { citizen: "/citizen/report" },
    copy: {
      citizen: {
        lead: "Four steps on one card: Problem, Details, Location, Send. Each opens once the one before it is answered.",
        steps: [
          "Problem: pick what kind of problem it is.",
          "Details: a short title and what you see. Tick \"someone could get hurt\" if it's dangerous: the report is filed as high priority.",
          "Location: pick the zone, then the exact spot. Search for it, or open the city map and drop a pin. Add a landmark the crew can find.",
          "Send: if the same problem is already reported nearby, choose \"Affects me too\" instead of filing it twice.",
          "Add up to 4 photos (PNG, JPG or WebP, up to 10 MB each). They're resized for you before sending.",
        ],
        tip: "The preview beside the card shows the report as the city receives it, and the response window the city promises.",
      },
    },
  },
  {
    id: "mine", group: "desk", roles: ["citizen"], title: "My Reports and Saved",
    to: { citizen: "/citizen/my-reports" },
    copy: {
      citizen: {
        lead: "Every report you filed, where it is now, and whether the city is keeping its promise.",
        steps: [
          "The tiles lock a view: still open, past the promise, resolved, off the board.",
          "Open a report to see its timeline, its photos and the promised window.",
          "Withdraw a report while it's still new and nobody has it. After that, ask the city to take it off, with a reason.",
          "Saved holds the reports you starred and the neighbours' reports you follow.",
        ],
        tip: "When the crew asks to close a report, it still reads In Progress until command confirms the fix.",
      },
    },
  },
  {
    id: "follow", group: "desk", roles: ["citizen"], title: "Follow a neighbour's report",
    to: { citizen: "/community?show=report" },
    copy: {
      citizen: {
        lead: "Back a report someone else filed, so the city sees how many people it affects.",
        steps: [
          "Community → Open reports lists your neighbours' open reports in the zone, most affected first.",
          "Affects me too adds you to the \"citizens affected\" count the city sees, and you follow the report. It can't be undone.",
          "Follow only sends you its updates. Unfollow any time.",
          "Tap someone's report on the map for the same two buttons.",
          "Reports you follow are in Saved. Their updates arrive in Notifications under Following.",
        ],
        tip: "The reporter's name, photos and notes stay private. You see the title, the place and where it is.",
      },
    },
  },

  /* ---------------- field ---------------- */
  {
    id: "field", group: "desk", roles: ["staff"], title: "Field Health",
    to: { staff: "/staff" },
    copy: {
      staff: {
        lead: "Live readings for the zone you're working in.",
        steps: [
          "The zone in the top bar decides which zone you see. Pick another there.",
          "Readings refresh on their own. The SYNCED light in the top bar shows the desk is live.",
          "The pill in the top bar is your most urgent file (red when it is past its window). Click it to go straight to it.",
          "The model follows the real sky over Kolkata: the day city after sunrise, the lit night city after dusk. The sun button beside the model switches between Live sky, Day and Night.",
        ],
      },
    },
  },
  {
    id: "assigned", group: "desk", roles: ["staff"], title: "Assigned Work",
    to: { staff: "/staff/assigned" },
    copy: {
      staff: {
        lead: "Every file on you, and the only place you move them.",
        steps: [
          "Each row carries its one next move: Start work, Request close, or Withdraw a close request.",
          "Request close needs a note on what was done. It's a request: the file closes only when command confirms.",
          "Command can send a file back with a reason. It returns to In Progress on you, and the reason shows on the file.",
          "Every file has a response window set by command. Breached means it's past it: those come first.",
          "The lane rail on top also has Operations (what needs you now), City Intake (the whole open board, read only) and Field Load (your record).",
        ],
        tip: "Your close times run to your close request, not to command's confirm, so a slow confirm never makes you late.",
      },
    },
  },

  /* ---------------- command ---------------- */
  {
    id: "command", group: "desk", roles: ["admin"], title: "Issue Command",
    to: { admin: "/admin/command" },
    copy: {
      admin: {
        lead: "The hub: what needs a decision now. Every issue page opens from its lane rail.",
        steps: [
          "Close requests wait for you here. Confirm the fix, or send it back to the crew with a reason.",
          "All Issues: every file, with search, filters and its full record.",
          "Assign Issues: every open file beside its best free match from the roster. One click dispatches; Fix repairs an expertise mismatch.",
          "Staff Management: each crew's load and performance. Rank and removal stay on the Staff Desk.",
          "Analytics shows close rate, time to resolve and service-window compliance. Audit Log has every action, with a CSV export.",
        ],
      },
    },
  },
  {
    id: "windows", group: "desk", roles: ["admin"], title: "Service Windows",
    to: { admin: "/admin/windows" },
    copy: {
      admin: {
        lead: "The city's deadline table: how long each priority has, and a ceiling for dangerous work.",
        steps: [
          "One window per priority, plus an optional ceiling per category.",
          "Edits stay a draft until you save. The save bar shows exactly what changes.",
          "A table where a higher priority gets more time than a lower one is refused.",
          "Saving never rewrites windows already running. The bar says how many keep their current window.",
          "Every save is in the Audit Log.",
        ],
      },
    },
  },
  {
    id: "desk", group: "desk", roles: ["admin"], title: "Staff Desk",
    to: { admin: "/admin/staff-desk" },
    copy: {
      admin: {
        lead: "The field roster and the clearance queue. Who works the field is decided here only.",
        steps: [
          "People apply on the staff request page. Their requests wait under Clearance.",
          "Accept with a rank. A one-time activation link goes to their email, and they show On field as Awaiting uplink until their first sign-in.",
          "Reject with a reason. It's kept on the record.",
          "Open a person to see their load. Change their rank, give or take the verified badge, or remove them from the field.",
          "Every change lands in the Audit Log.",
        ],
      },
    },
  },

  /* ---------------- every desk ---------------- */
  {
    id: "map", group: "shared", roles: ["citizen", "staff", "admin"], title: "Map",
    to: { citizen: "/map", staff: "/map", admin: "/map" },
    copy: {
      citizen: {
        lead: "Your reports, your neighbours' open issues, and the services around you.",
        steps: [
          "Tap a pin for its card. Your own report opens in full; anyone else's shows the public card with Follow.",
          "Search a zone, landmark or open issue in the box at the top.",
          "Report issue (tools on the left) starts a report at the spot you picked.",
          "Nearby finds hospitals, pharmacies, banks, food and schools around a searched place, a dropped pin or you.",
          "Route here draws a driving route from your location. Use My location first.",
          "Map type (top right) switches between street, satellite and terrain.",
        ],
      },
      staff: {
        lead: "Your files' pins and today's route.",
        steps: [
          "Today's route orders your open files: overdue first, then the nearest stop each time.",
          "Route to next stop draws the drive. Open file goes straight to it.",
          "Tap one of your pins for its card, then Open the file.",
          "Nearby finds services around a spot. Tracking draws your own trail on this device only.",
        ],
      },
      admin: {
        lead: "Every file in the city, by stage and by zone.",
        steps: [
          "The City operations row at the bottom counts each stage. Tap one to show only those pins.",
          "Open in All Issues opens the stage you picked.",
          "Zones past their window glow. Tap a zone for its numbers and open it in Issue Command.",
          "Tap a pin for its card, then Open the file.",
        ],
      },
    },
  },
  {
    id: "community", group: "shared", roles: ["citizen", "staff", "admin"], title: "Community",
    to: { citizen: "/community", staff: "/community", admin: "/community" },
    copy: {
      citizen: {
        lead: "Your zone's board: proposals, polls, open reports, what got fixed and what the city announced.",
        steps: [
          "The board follows the zone in the top bar. The zone button switches it.",
          "Back a proposal with Affects me or I'd use this, or raise a concern with a reason.",
          "Vote once in a live poll. Results show after you vote, and you can change your vote until it closes.",
          "Fixed near you: say Fixed now or Still happening. A Still happening goes back to the crew.",
          "Propose an improvement for something new the zone needs. Something broken is a report, not a proposal.",
        ],
      },
      staff: {
        lead: "The board for your zones, and the notices you post on your own files.",
        steps: [
          "Post a work notice on one of your open files: what, when (24 h, IST) and for how long. Residents in that zone see it.",
          "End a notice when the work is done. It also ends when the file closes.",
          "Still happening: residents say a fix didn't hold. Answer it: fixed, or you'll take another look.",
          "Announcements from command for the crews are on the board too.",
        ],
      },
      admin: {
        lead: "Community Command: proposals ranked by the city's evidence, polls, announcements and moderation.",
        steps: [
          "Decide a proposal: approve it, plan it, turn it into an issue, move it to a poll, or answer Not now with a reason.",
          "Open a poll from a proposal or on its own. Close it with a published outcome.",
          "Publish an announcement to one zone or every zone, for citizens, field crews or both, with an end time.",
          "Hide a post with a reason. Every hide is on the moderation log and in the Audit Log.",
        ],
      },
    },
  },
  {
    id: "alerts", group: "shared", roles: ["citizen", "staff", "admin"], title: "Notifications",
    to: { citizen: "/notifications", staff: "/notifications", admin: "/notifications" },
    copy: {
      citizen: {
        lead: "Updates on your reports and on what you follow.",
        steps: [
          "My reports: crews, progress and fixes on reports you filed.",
          "Following: updates on reports and proposals you back or follow.",
          "Decisions: answers to your proposals and requests.",
          "Opening an update marks it read and takes you to the report.",
        ],
        tip: "Mute a group, choose pop-ups and set quiet hours in Settings → Alerts.",
      },
      staff: {
        lead: "Changes to your work, the moment they happen.",
        steps: [
          "New work: files assigned to you, moved, or with a note from command.",
          "Returns and flags: a file sent back, or a flag command decided.",
          "Service windows: a file close to its deadline, or past it.",
          "Opening an update marks it read and opens the work order.",
        ],
        tip: "Your work and service windows can't be muted. Everything else can, in Settings → Alerts.",
      },
      admin: {
        lead: "Everything that needs command: issues, the field and the Staff Desk.",
        steps: [
          "Needs a decision: close requests, flags, removal requests and clearance. They carry a DECIDE tag.",
          "Breaches: files past their service window.",
          "Duplicates: possible repeats to merge.",
          "Opening an update marks it read and opens the file or the Staff Desk.",
        ],
        tip: "Decisions and breaches can't be muted. Everything else can, in Settings → Alerts.",
      },
    },
  },

  /* ---------------- account ---------------- */
  {
    id: "settings", group: "account", roles: ["citizen", "staff", "admin"], title: "Settings",
    to: { citizen: "/settings", staff: "/settings", admin: "/settings" },
    copy: {
      citizen: {
        lead: "Your profile, home zone and sign-in, and how this device behaves.",
        steps: [
          "Profile: display name, photo and home zone. These are saved to your account.",
          "Alerts and Display & 3D are kept on this device only. Each row says which.",
          "Check this device suggests a 3D quality that runs smoothly here.",
          "City sky keeps the model on Live sky, or always on Day or Night.",
          "Export downloads your settings. Reset this device puts them back to the defaults.",
        ],
      },
      staff: {
        lead: "Your duty status, how this device behaves, and your sign-in.",
        steps: [
          "Duty status (on duty, on break, off duty) shows to command and to dispatch.",
          "Rank, expertise and zone are set by command on the Staff Desk. Settings shows them, read only.",
          "Alerts and Display & 3D are kept on this device only. City sky keeps the model on Live sky, or always on Day or Night.",
          "Sign out when away: your desk closes after the time you pick.",
        ],
      },
      admin: {
        lead: "Your designation and office, the command desk, and your sign-in.",
        steps: [
          "Profile: display name, designation and office, saved to your account.",
          "Access by role shows what each desk is allowed to do. The server enforces it.",
          "System status shows whether the desk is connected to the city server.",
          "The command desk always signs out after 15 minutes to 1 hour away. Pick the time.",
          "Display & 3D, kept on this device: 3D quality, City sky (Live sky, Day or Night), orbit and motion.",
        ],
      },
    },
  },
  {
    id: "access", group: "account", roles: ["citizen", "staff", "admin"], title: "Sign-in and password",
    to: { citizen: "/settings#signin", staff: "/settings#signin", admin: "/settings#signin" },
    copy: {
      citizen: {
        lead: "A failed sign-in says \"Email or password is incorrect for this desk\". Check you picked the citizen desk.",
        steps: [
          "Forgot the password? Choose Forgot password on the sign-in page. A one-time link comes to your email.",
          "Settings → Sign-in & Security changes your email (confirmed by a link to the new address) and your password.",
          "Signed in with Google? Your email and password stay with Google.",
          "Lost a phone or used a shared computer? Sign out everywhere from the same panel.",
        ],
      },
      staff: {
        lead: "A failed sign-in says \"Email or password is incorrect for this desk\". Use the work email command cleared.",
        steps: [
          "Forgot the password? Choose Forgot password on the field sign-in. A one-time link comes to your work email.",
          "Signed in already? Settings → Sign-in & Security sends the same link.",
          "Your work email is set by command. Ask an admin on the Staff Desk to change it.",
          "Sign out everywhere from Settings if a device may be in the wrong hands.",
        ],
      },
      admin: {
        lead: "A failed sign-in says \"Email or password is incorrect for this desk\".",
        steps: [
          "Forgot the password? Choose Forgot password on the command sign-in, or Settings → Sign-in & Security. A one-time link goes to the command email.",
          "A command password needs 16 characters or more.",
          "Lost the command inbox too? Write to support. Recovery is done on the server, after the team confirms it's you.",
          "Sign out everywhere from Settings if a device may be in the wrong hands.",
        ],
      },
    },
  },
];

/* "Start here": the three things each desk asks about most */
export const QUICK = {
  citizen: [
    { topic: "report", title: "Report a problem", line: "Four steps, about a minute" },
    { topic: "follow", title: "Back a neighbour's report", line: "So the city sees how many it affects" },
    { topic: "mine", title: "Where is my report?", line: "Status, timeline and the promise" },
  ],
  staff: [
    { topic: "assigned", title: "Close a file", line: "Request close, then command confirms" },
    { topic: "map", title: "Plan today's route", line: "Overdue first, then nearest" },
    { topic: "community", title: "Tell residents about work", line: "Post a work notice" },
  ],
  admin: [
    { topic: "command", title: "Confirm a close", line: "Or send it back with a reason" },
    { topic: "desk", title: "Clear a new crew member", line: "Accept with a rank" },
    { topic: "windows", title: "Change a deadline", line: "Service windows, safely" },
  ],
};

/* Keys that work across the desk pages */
export const KEYS = [
  { k: "/", what: "Search on this page" },
  { k: "1–9", what: "Lock a tile's lens" },
  { k: "Esc", what: "Release the lens, or close what's open" },
  { k: "Enter", what: "Run the next move on a locked row" },
];
