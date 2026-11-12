
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Session = require("../models/Session");
const { validatePassword } = require("../utils/passwordValidator");

const ALLOWED_ROLES = ["citizen", "staff", "admin"];

const USER_FIELDS =
  "name displayName email role zone provider avatar dutyStatus expertise rank experience verified designation office prefs zoneChangedAt isActive createdAt";

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateUserId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Revoke every active session belonging to a user.

// Revoke every active session belonging to a user.
const revokeUserSessions = async (userId) => {
  await Session.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    }
  );
};



const disconnectUserSockets = (userId) => {
  try {
    const { getIO } = require("../socket/socket");

    getIO()
      .in(`user:${userId}`)
      .disconnectSockets(true);
  } catch (error) {
    console.error(
      "Socket disconnection error:",
      error.message
    );
  }
};



// Prevent removal of the last active administrator.

// Prevent removal of the last active administrator.
const protectLastAdmin = async (user, nextRole, nextActive) => {
  // Only an active administrator can be the last active administrator.
  if (user.role !== "admin" || user.isActive !== true) {
    return false;
  }

  const willStopBeingAdmin =
    nextRole !== "admin" || nextActive === false;

  if (!willStopBeingAdmin) {
    return false;
  }

  const otherAdmins = await User.countDocuments({
    _id: { $ne: user._id },
    role: "admin",
    isActive: true,
  });

  return otherAdmins === 0;
};


// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(USER_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch users.",
    });
  }
};

// GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateUserId(id)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id)
      .select(USER_FIELDS);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Get user error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch user.",
    });
  }
};

// PATCH /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, zone, role } = req.body || {};

    if (!validateUserId(id)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        message: "Please provide a valid name.",
      });
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !isValidEmail(email.trim())
      ) {
        return res.status(400).json({
          message: "Please provide a valid email address.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (emailExists) {
        return res.status(409).json({
          message: "Email is already in use.",
        });
      }

      user.email = normalizedEmail;
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (zone !== undefined) {
      if (typeof zone !== "string") {
        return res.status(400).json({
          message: "Zone must be a string.",
        });
      }

      user.zone = zone.trim();
    }

    const roleChanged =
  role !== undefined && role !== user.role;

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          message: "Invalid role.",
        });
      }

      if (
        req.user._id.toString() === id &&
        role !== "admin"
      ) {
        return res.status(400).json({
          message: "You cannot remove your own admin role.",
        });
      }

      const wouldRemoveLastAdmin = await protectLastAdmin(
        user,
        role,
        user.isActive
      );

      if (wouldRemoveLastAdmin) {
        return res.status(400).json({
          message: "Cannot remove the last active administrator.",
        });
      }

      user.role = role;
    }

    await user.save();

    // Role changes invalidate existing sessions.
    if (roleChanged) {
  await revokeUserSessions(user._id);
  disconnectUserSockets(user._id);
}

    const updatedUser = await User.findById(id)
      .select(USER_FIELDS);

    return res.json({
      message: "User updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email is already in use.",
      });
    }

    return res.status(500).json({
      message: "Failed to update user.",
    });
  }
};

// PATCH /api/admin/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (!validateUserId(id)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false.",
      });
    }

    if (
      req.user._id.toString() === id &&
      !isActive
    ) {
      return res.status(400).json({
        message: "You cannot disable your own account.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const wouldRemoveLastAdmin = await protectLastAdmin(
      user,
      user.role,
      isActive
    );

    if (wouldRemoveLastAdmin) {
      return res.status(400).json({
        message: "Cannot disable the last active administrator.",
      });
    }

    user.isActive = isActive;
    await user.save();

    if (!isActive) {
  await revokeUserSessions(user._id);
  disconnectUserSockets(user._id);
}

    const updatedUser = await User.findById(id)
      .select(USER_FIELDS);

    return res.json({
      message: isActive
        ? "User account activated."
        : "User account disabled.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user status error:", error.message);

    return res.status(500).json({
      message: "Failed to update user status.",
    });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateUserId(id)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        message: "You cannot delete your own account.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const wouldRemoveLastAdmin = await protectLastAdmin(
      user,
      null,
      false
    );

    if (wouldRemoveLastAdmin) {
      return res.status(400).json({
        message: "Cannot delete the last active administrator.",
      });
    }

    user.isActive = false;
    await user.save();

    await revokeUserSessions(user._id);
    disconnectUserSockets(user._id);

    return res.json({
      message: "User deleted successfully.",
      userId: id,
    });
  } catch (error) {
    console.error("Delete user error:", error.message);

    return res.status(500).json({
      message: "Failed to delete user.",
    });
  }
};

// POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      zone,
    } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const selectedRole = role || "citizen";

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (!ALLOWED_ROLES.includes(selectedRole)) {
      return res.status(400).json({
        message: "Invalid role.",
      });
    }

    if (zone !== undefined && typeof zone !== "string") {
      return res.status(400).json({
        message: "Zone must be a string.",
      });
    }

    const passwordError = validatePassword(password, {
      role: selectedRole,
      name: normalizedName,
      email: normalizedEmail,
    });

    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
      });
    }

    // Keep the additional admin-specific requirement.
    if (selectedRole === "admin") {
      const specialCharacterCount =
        (password.match(/[^A-Za-z0-9]/g) || []).length;

      if (specialCharacterCount < 2) {
        return res.status(400).json({
          message:
            "Admin password must contain at least 2 special characters.",
        });
      }
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const idleDefaults = {
  citizen: 0,
  staff: 60,
  admin: 30
};

const user = await User.create({
  name: normalizedName,
  email: normalizedEmail,
  password: hashedPassword,
  role: selectedRole,
  zone: zone ? zone.trim() : "",
  provider: "password",
  isActive: true,
  prefs: {
    idleSignOut: idleDefaults[selectedRole]
  }
});
    const safeUser = await User.findById(user._id)
      .select(USER_FIELDS);

    return res.status(201).json({
      message: "User created successfully.",
      user: safeUser,
    });
  } catch (error) {
    console.error("Create user error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    return res.status(500).json({
      message: "Failed to create user.",
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
};