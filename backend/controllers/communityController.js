
const crypto = require("crypto");

const CommunityAnnouncement = require("../models/CommunityAnnouncement");
const CommunityPoll = require("../models/CommunityPoll");
const CommunityHistory = require("../models/CommunityHistory");
const { getIO } = require("../socket/socket");
const Issue = require("../models/Issue");
const StaffRequest = require("../models/StaffRequest");

const makeId = (prefix) =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

const fail = (res, status, message) =>
  res.status(status).json({ message });


function emitCommunityChanged(req, type, id, zones) {
  try {
    const io = getIO();
    const list = Array.isArray(zones) ? zones : [zones || "all"];
    const rooms = new Set(["role:admin"]);

    for (const zone of list) {
      if (zone === "all") {
        rooms.add("role:citizen");
        rooms.add("role:staff");
        rooms.add("role:admin");
      } else if (zone) {
        rooms.add(`zone:${zone}`);
      }
    }

    io.to([...rooms]).emit("community:changed", {
      type,
      id,
      zone: list.length === 1 ? list[0] : list,
      at: new Date().toISOString(),
      actorId: String(req.user._id),
      actorTab: req.get("X-Client-Tab") || null
    });
  } catch (error) {
    // Database operations should still succeed if realtime is unavailable.
    console.error("[Community] Socket notification failed:", error.message);
  }
}

function announcementJSON(doc) {
  const a = doc.toObject ? doc.toObject() : doc;
  return {
    id: a.publicId,
    title: a.title,
    body: a.body,
    zones: a.zones || [],
    audience: a.audience || { citizens: true, staff: true },
    by: a.by || "Admin",
    at: a.at,
    until: a.until,
    hidden: false
  };
}

function pollJSON(doc) {
  const p = doc.toObject ? doc.toObject() : doc;
  const rawVotes = p.votes instanceof Map
    ? Object.fromEntries(p.votes)
    : (p.votes || {});

  return {
    id: p.publicId,
    ward: p.ward,
    question: p.question,
    options: (p.options || []).map((o) => ({
      id: o.id,
      label: o.label,
      base: 0
    })),
    votes: rawVotes,
    opensAt: p.opensAt,
    closesAt: p.closesAt,
    status: p.status || "open",
    from: p.from || null,
    outcome: null,
    by: p.by || "Admin"
  };
}

function historyJSON(record) {
  const snapshot = record.snapshot || {};
  if (record.type === "announcement") {
    return {
      ...snapshot,
      id: record.publicId,
      hidden: snapshot.hidden || false
    };
  }
  return {
    ...snapshot,
    id: record.publicId,
    status: "closed"
  };
}

async function archiveAnnouncement(doc, reason, actorId = null) {
  const snapshot = announcementJSON(doc);

  if (reason === "withdrawn") {
    snapshot.hidden = {
      by: doc.by || "Admin",
      at: new Date(),
      reason: "Withdrawn by administrator"
    };
  }

  await CommunityHistory.updateOne(
    { type: "announcement", publicId: doc.publicId },
    {
      $setOnInsert: {
        type: "announcement",
        publicId: doc.publicId,
        snapshot,
        reason,
        archivedBy: actorId
      }
    },
    { upsert: true }
  );

  await CommunityAnnouncement.deleteOne({ _id: doc._id });
}

async function archiveExpiredAnnouncements() {
  const expired = await CommunityAnnouncement.find({
    until: { $lte: new Date() }
  });

  for (const announcement of expired) {
    await archiveAnnouncement(announcement, "expired");
  }
}

// GET /api/community
exports.getCommunity = async (req, res) => {
  try {
    await archiveExpiredAnnouncements();

    const isAdmin = req.user.role === "admin";
    const zone = req.user.zone || "";

    let allowedZones = [zone];

if (req.user.role === "staff") {
  // Get the staff member's selected working zone.
  const staffRequest = await StaffRequest.findOne({
    email: String(req.user.email || "").toLowerCase(),
    status: { $in: ["approved", "completed"] }
  })
    .select("zone")
    .lean();

  // Get wards of unresolved issues assigned to this staff member.
  const assignedWards = await Issue.distinct("ward", {
    assignedTo: req.user._id,
    status: { $ne: "resolved" },
    removed: null
  });

  allowedZones = [
    ...new Set([
      req.user.zone,
      staffRequest?.zone,
      ...assignedWards
    ].filter(Boolean))
  ];
}

    const announcementQuery = isAdmin
    ? {}
    : {
        until: { $gt: new Date() },
        [`audience.${req.user.role === "citizen" ? "citizens" : "staff"}`]: true,
        $or: [
            { zones: "all" },
            { zones: { $in: allowedZones } }
        ]
        };

    const activeAnnouncements = await CommunityAnnouncement
    .find(announcementQuery)
    .sort({ at: -1 })
    .lean();

    const activePollQuery = isAdmin
      ? {}
      : { $or: [{ ward: "all" }, { ward: zone }] };

    const activePolls = await CommunityPoll.find(activePollQuery)
      .sort({ opensAt: -1 })
      .lean();

    const announcements = activeAnnouncements.map(announcementJSON);
    const polls = activePolls.map(pollJSON);

    if (isAdmin) {
      const archived = await CommunityHistory.find({
        type: { $in: ["announcement", "poll"] }
      }).sort({ archivedAt: -1 }).limit(300).lean();

      for (const record of archived) {
        if (record.type === "announcement") {
          announcements.push(historyJSON(record));
        } else {
          const archivedPoll = historyJSON(record);
          // Do not overwrite a poll that is still active.
          if (!polls.some((p) => p.id === archivedPoll.id)) {
            polls.push(archivedPoll);
          }
        }
      }
    } else {
      const closedPolls = await CommunityHistory.find({
        type: "poll",
        $or: [
          { "snapshot.ward": "all" },
          { "snapshot.ward": zone }
        ]
      }).sort({ archivedAt: -1 }).limit(100).lean();

      for (const record of closedPolls) {
        polls.push(historyJSON(record));
      }
    }

    return res.json({ announcements, polls });
  } catch (error) {
    console.error("[Community] getCommunity:", error);
    return fail(res, 500, "Could not load Community data.");
  }
};

// POST /api/community/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, body, zones, citizens = true, staff = true, hours = 72 } =
      req.body || {};

    if (typeof title !== "string" || title.trim().length < 8 ||
        title.trim().length > 110) {
      return fail(res, 400, "Title must contain 8 to 110 characters.");
    }

    if (typeof body !== "string" || !body.trim() || body.trim().length > 300) {
      return fail(res, 400, "Announcement body must contain 1 to 300 characters.");
    }

    if (!Array.isArray(zones) || zones.length === 0 ||
        zones.some((z) => typeof z !== "string" || !z.trim())) {
      return fail(res, 400, "Select at least one valid zone.");
    }

    if (!citizens && !staff) {
      return fail(res, 400, "Select at least one audience.");
    }

    const allowedHours = [24, 72, 168, 336];
    if (!allowedHours.includes(Number(hours))) {
      return fail(res, 400, "Invalid announcement duration.");
    }

    const now = new Date();
    const doc = await CommunityAnnouncement.create({
      publicId: makeId("ANN"),
      title: title.trim(),
      body: body.trim(),
      zones: [...new Set(zones)],
      audience: { citizens: Boolean(citizens), staff: Boolean(staff) },
      by: req.user.displayName || req.user.name,
      createdBy: req.user._id,
      at: now,
      until: new Date(now.getTime() + Number(hours) * 60 * 60 * 1000)
    });

    emitCommunityChanged(req, "announcement-created", doc.publicId, doc.zones);

    return res.status(201).json({
      item: announcementJSON(doc)
    });
  } catch (error) {
    console.error("[Community] createAnnouncement:", error);
    return fail(res, 500, "Could not publish announcement.");
  }
};

// DELETE /api/community/announcements/:id
exports.withdrawAnnouncement = async (req, res) => {
  try {
    const doc = await CommunityAnnouncement.findOne({
      publicId: req.params.id
    });

    if (!doc) {
      return fail(res, 404, "Announcement not found or already withdrawn.");
    }

    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return fail(res, 400, "A withdrawal reason is required.");
    }

    await CommunityHistory.updateOne(
      { type: "announcement", publicId: doc.publicId },
      {
        $setOnInsert: {
          type: "announcement",
          publicId: doc.publicId,
          snapshot: {
            ...announcementJSON(doc),
            hidden: {
              by: req.user.displayName || req.user.name,
              at: new Date(),
              reason
            }
          },
          reason: "withdrawn",
          archivedBy: req.user._id
        }
      },
      { upsert: true }
    );

    await CommunityAnnouncement.deleteOne({ _id: doc._id });

    emitCommunityChanged(req, "announcement-withdrawn", doc.publicId, doc.zones);

    return res.json({ ok: true, id: doc.publicId });
  } catch (error) {
    console.error("[Community] withdrawAnnouncement:", error);
    return fail(res, 500, "Could not withdraw announcement.");
  }
};

// POST /api/community/polls
exports.createPoll = async (req, res) => {
  try {
    const { question, ward, options, hours = 48, from = null } = req.body || {};

    if (typeof question !== "string" ||
        question.trim().length < 8 ||
        question.trim().length > 120) {
      return fail(res, 400, "Question must contain 8 to 120 characters.");
    }

    if (typeof ward !== "string" || !ward.trim()) {
      return fail(res, 400, "A valid poll zone is required.");
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
      return fail(res, 400, "A poll must have 2 to 4 options.");
    }

    const cleanedOptions = options.map((option, index) => ({
      id: ["a", "b", "c", "d"][index],
      label: String(option.label || option).trim()
    }));

    if (cleanedOptions.some((o) => !o.label || o.label.length > 60)) {
      return fail(res, 400, "Each option must contain 1 to 60 characters.");
    }

    const uniqueLabels = cleanedOptions.map((o) => o.label.toLowerCase());
    if (new Set(uniqueLabels).size !== uniqueLabels.length) {
      return fail(res, 400, "Poll options must be different.");
    }

    const allowedHours = [24, 48, 72, 168];
    if (!allowedHours.includes(Number(hours))) {
      return fail(res, 400, "Invalid poll duration.");
    }

    const now = new Date();
    const doc = await CommunityPoll.create({
      publicId: makeId("POL"),
      question: question.trim(),
      ward: ward.trim(),
      options: cleanedOptions,
      votes: new Map(),
      opensAt: now,
      closesAt: new Date(now.getTime() + Number(hours) * 60 * 60 * 1000),
      status: "open",
      from,
      by: req.user.displayName || req.user.name,
      createdBy: req.user._id
    });

    emitCommunityChanged(req, "poll-created", doc.publicId, doc.ward);

    return res.status(201).json({ item: pollJSON(doc) });
  } catch (error) {
    console.error("[Community] createPoll:", error);
    return fail(res, 500, "Could not create poll.");
  }
};

// POST /api/community/polls/:id/vote
exports.votePoll = async (req, res) => {
  try {
    const { optionId } = req.body || {};
    const userId = String(req.user._id);

    const poll = await CommunityPoll.findOne({ publicId: req.params.id });

    if (!poll) {
      return fail(res, 404, "Poll not found or already closed.");
    }

    if (poll.status !== "open" || poll.closesAt <= new Date()) {
      return fail(res, 409, "This poll is no longer open.");
    }

    if (!poll.options.some((o) => o.id === optionId)) {
      return fail(res, 400, "Select a valid poll option.");
    }

    const updated = await CommunityPoll.findOneAndUpdate(
      {
        _id: poll._id,
        status: "open",
        closesAt: { $gt: new Date() }
      },
      {
        $set: { [`votes.${userId}`]: optionId }
      },
      { new: true }
    );

    if (!updated) {
      return fail(res, 409, "This poll has just closed.");
    }

    emitCommunityChanged(req, "poll-voted", poll.publicId, poll.ward);

    return res.json({ item: pollJSON(updated) });
  } catch (error) {
    console.error("[Community] votePoll:", error);
    return fail(res, 500, "Could not save your vote.");
  }
};

// POST /api/community/polls/:id/close
exports.closePoll = async (req, res) => {
  try {
    const { optionId, note } = req.body || {};
    const cleanNote = String(note || "").trim();

    if (cleanNote.length < 6) {
      return fail(res, 400, "The outcome note must contain at least 6 characters.");
    }

    const poll = await CommunityPoll.findOne({ publicId: req.params.id });

    if (!poll) {
      return fail(res, 404, "Poll not found or already closed.");
    }

    if (!poll.options.some((o) => o.id === optionId)) {
      return fail(res, 400, "Select a valid outcome option.");
    }

    const now = new Date();
    const updated = await CommunityPoll.findOneAndUpdate(
    { _id: poll._id, status: "open" },
    { $set: { status: "closing" } },
    { new: true }
    );

    if (!updated) {
      return fail(res, 409, "This poll has already been closed.");
    }

    const snapshot = pollJSON(updated);
    snapshot.status = "closed";
    snapshot.closesAt = now < updated.closesAt ? now : updated.closesAt;
    snapshot.outcome = {
      optionId,
      note: cleanNote,
      by: req.user.displayName || req.user.name,
      at: now
    };

    await CommunityHistory.updateOne(
      { type: "poll", publicId: poll.publicId },
      {
        $setOnInsert: {
          type: "poll",
          publicId: poll.publicId,
          snapshot,
          reason: "closed",
          archivedBy: req.user._id
        }
      },
      { upsert: true }
    );

    await CommunityPoll.deleteOne({ _id: poll._id });

    emitCommunityChanged(req, "poll-closed", poll.publicId, poll.ward);

    return res.json({ ok: true, item: snapshot });
  } catch (error) {
    console.error("[Community] closePoll:", error);
    return fail(res, 500, "Could not close poll.");
  }
};