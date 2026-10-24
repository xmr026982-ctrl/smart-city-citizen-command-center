export const SUPPORT = "supportsmartkolkata@gmail.com";

// Static until person 1's login is connected. Then this becomes the live roster.
export const ADMIN = "Priti Sarkar";
export const STAFF = [
  "Koushik Bhowmik",
  "Subhomoy Ghosh",
  "Taras Hembram",
  "Sayan Majumder",
  "Swarup Sutradhar",
];

export const STATUS = [
  { id: "submitted", label: "Submitted", note: "Filed. The desk has it." },
  { id: "acknowledged", label: "Acknowledged", note: "Command has seen it." },
  { id: "in_progress", label: "In Progress", note: "A field team is working on it." },
  { id: "resolved", label: "Resolved", note: "Command has confirmed the work is done." },
];

export const TOPICS = [
  {
    id: "city",
    title: "City Health",
    roles: ["citizen", "admin"],
    copy: {
      citizen: {
        lead: "Live readings for the zone you are standing in.",
        steps: [
          "Open City Health from the sidebar.",
          "Switch the zone in the top bar. The plate follows that zone only.",
          "Air, traffic, water, and power refresh on their own.",
          "The sparkline under a card is the last stretch of readings, not a forecast.",
        ],
      },
      admin: {
        lead: "The command plate. Live readings for the zone you have selected.",
        steps: [
          "Open City Health from the sidebar.",
          "Switch the zone in the top bar to read that area only.",
          "Air, traffic, water, and power refresh on their own.",
          "A spike here is a signal. The file itself lives in Issue Records.",
        ],
      },
    },
  },
  {
    id: "field",
    title: "Field Health",
    roles: ["staff"],
    copy: {
      staff: {
        lead: "The field plate. Live readings for the zone you are working in.",
        steps: [
          "Open Field Health from the sidebar.",
          "Switch the zone in the top bar. The plate follows that zone only.",
          "Air, traffic, water, and power refresh on their own.",
          "The sparkline under a card is the last stretch of readings, not a forecast.",
        ],
      },
    },
  },
  {
    id: "map",
    title: "Map",
    roles: ["citizen", "staff", "admin"],
    copy: {
      citizen: {
        lead: "The city map. This is where a report gets its pin.",
        steps: [
          "Open Map from the sidebar.",
          "Choose a zone first. The pin stays closed until you do.",
          "Zoom in, then drop the pin on the exact spot.",
          "The pin fills the location field on Report Issue.",
        ],
      },
      staff: {
        lead: "The field map. This is where an assigned file sits.",
        steps: [
          "Open Map from the sidebar.",
          "Click a marker for the short detail of that file.",
          "Open the file for the full location and the note from command.",
          "Zoom in before you move. The pin is the work site.",
        ],
      },
      admin: {
        lead: "The command map. Every open file, by zone.",
        steps: [
          "Open Map from the sidebar.",
          "Switch the zone in the top bar to thin the markers.",
          "Click a marker for the short detail.",
          "Open the file to read the full record in Issue Records.",
        ],
      },
    },
  },
  {
    id: "report",
    title: "Report Issue",
    roles: ["citizen"],
    copy: {
      citizen: {
        lead: "Three steps. Describe, locate, then photos.",
        steps: [
          "Pick the zone first. The location field stays closed until you do.",
          "Describe what happened in plain words.",
          "Search the area on the map, then select the spot. The pin fills the location.",
          "Add up to 5 photos, 5 MB each, PNG or JPG.",
          "If a similar open report already exists in that zone, you will see a warning before you submit.",
        ],
      },
    },
  },
  {
    id: "community",
    title: "Community",
    roles: ["citizen", "admin"],
    copy: {
      citizen: {
        lead: "The shared board for the zone. Read it before you file.",
        steps: [
          "Open Community from the sidebar.",
          "See what is already open in the zone.",
          "A new report still starts from Report Issue, not from this board.",
        ],
      },
      admin: {
        lead: "The zone board. This is the public view of open files.",
        steps: [
          "Open Community from the sidebar.",
          "Switch the zone to read that area only.",
          "This board does not assign. Assignment lives in Issue Records.",
        ],
      },
    },
  },
  {
    id: "assigned",
    title: "Assigned Work",
    roles: ["staff"],
    copy: {
      staff: {
        lead: "Files command has put on you.",
        steps: [
          "Open Assigned Work from the sidebar.",
          "Open a file to see the location and the note from command.",
          "Move a file to In Progress yourself.",
          "A close is a request. It is not final until command confirms.",
        ],
      },
    },
  },
  {
    id: "records",
    title: "Issue Records",
    roles: ["admin"],
    copy: {
      admin: {
        lead: "Every file the city has. This is the record, not the field.",
        steps: [
          "Open Issue Records from the sidebar.",
          "Search or filter to find a file.",
          "Open a file to read the timeline and the location.",
          `Assign, priority, and confirm live in the assign step. Command on this desk is ${ADMIN}.`,
        ],
      },
    },
  },
  {
    id: "desk",
    title: "Staff Desk",
    roles: ["admin"],
    copy: {
      admin: {
        lead: "The field roster. Appoint, verify, rank, and remove. All of it lives here.",
        steps: [
          "Open Staff Desk from the sidebar. The live roster is on that page, not here.",
          "Appoint a new staff from this desk. No one enters the field from anywhere else.",
          "Open a person to see their load and their work.",
          "Give a verified badge, or promote a rank, from that panel. Everyone starts as Field Operative.",
          `Remove a staff from the system from this desk. Only ${ADMIN} can appoint, verify, rank, or remove.`,
        ],
      },
    },
  },
  {
    id: "alerts",
    title: "Notifications",
    roles: ["citizen", "staff", "admin"],
    copy: {
      citizen: {
        lead: "Movement on your own reports. Nothing else.",
        steps: [
          "Open Notifications from the sidebar.",
          "You are told when your report moves: acknowledged, in progress, resolved.",
          "The waiting step is never shown to you.",
          "A city problem is not filed from here. File it from Report Issue.",
        ],
      },
      staff: {
        lead: "Command's reply on files that are on you.",
        steps: [
          "Open Notifications from the sidebar.",
          "You are told when command confirms a close.",
          "You are told when command sends a file back to the field.",
          "A status change you make yourself does not land here. It lands on command.",
        ],
      },
      admin: {
        lead: "What the city has just filed, and what the field is asking to close.",
        steps: [
          "Open Notifications from the sidebar.",
          "A new report lands here when a citizen files it.",
          "A close request lands here when the field asks to finish a file.",
          "Confirm or send back from Issue Records, not from this list.",
        ],
      },
    },
  },
  {
    id: "access",
    title: "Sign-in and account",
    roles: ["citizen", "staff", "admin"],
    copy: {
      citizen: {
        lead: "A failed sign-in says: Access denied. Check your assigned credentials.",
        steps: [
          "You are signed in as a citizen.",
          "Settings holds your desk preferences for this device.",
          "If the desk will not open, or the page is blank, use the address below.",
        ],
      },
      staff: {
        lead: "A failed sign-in says: Access denied. Check your assigned credentials.",
        steps: [
          "You are signed in as field staff.",
          "Settings holds your desk preferences for this device.",
          "If the field desk will not open, or the page is blank, use the address below.",
        ],
      },
      admin: {
        lead: "A failed sign-in says: Access denied. Check your assigned credentials.",
        steps: [
          "You are signed in as command.",
          "Settings holds your desk preferences for this device.",
          "If command will not open, or the page is blank, use the address below.",
        ],
      },
    },
  },
];