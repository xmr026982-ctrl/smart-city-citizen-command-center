const mongoose = require("mongoose");
const User = require("../models/User");

const getUsers = async (req, res) => {
    try {
        const users = await User.find()
        .select("-password")
        .sort({ createdAt: -1 });

        res.json({
            count: users.length,
            users
        });

    } catch (error) {
        console.error("Get users error:", error);

        res.status(500).json({
            message: "Failed to fetch users."
        });

    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        const user = await User.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        res.json({
            user
        });

    } catch (error) {
        console.error("Get user error:", error);

        res.status(500).json({
            message: "Failed to fetch user."
        });

    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, ward, role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Name cannot be empty."
                });
            }

            user.name = name.trim();
        }

        if (email !== undefined) {
            const normalizedEmail = email.trim().toLowerCase();

            const emailExists = await User.findOne({
                email: normalizedEmail,
                _id: { $ne: id }
            });

            if (emailExists) {
                return res.status(409).json({
                    message: "Email is already in use."
                });
            }

            user.email = normalizedEmail;
        }

        if (ward !== undefined) {
            user.ward = ward.trim();
        }

        if (role !== undefined) {
            const allowedRoles = ["citizen", "moderator", "admin"];

            if (!allowedRoles.includes(role)) {
                return res.status(400).json({
                    message: "Invalid role."
                });
            }

            // Admin cannot remove their own admin role.
            if (
                req.user._id.toString() === id &&
                role !== "admin"
            ) {
                return res.status(400).json({
                    message: "You cannot remove your own admin role."
                });
            }

            user.role = role;
        }

        await user.save();

        const updatedUser = await User.findById(id).select("-password");

        res.json({
            message: "User updated successfully.",
            user: updatedUser
        });


    } catch (error) {
        console.error("Update user error:", error);

        res.status(500).json({
            message: "Failed to update user."
        });

    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                message: "isActive must be true or false."
            });
        }

        if (req.user._id.toString() === id && !isActive) {
            return res.status(400).json({
                message: "You cannot disable your own account."
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        user.isActive = isActive;

        await user.save();

        const updatedUser = await User.findById(id).select("-password");

        res.json({
            message: isActive
                ? "User account activated."
                : "User account disabled.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Update user status error:", error);

        res.status(500).json({
            message: "Failed to update user status."
        });

    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        if (req.user._id.toString() === id) {
            return res.status(400).json({
                message: "You cannot delete your own account."
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        await User.findByIdAndDelete(id);

        res.json({
            message: "User deleted successfully.",
            userId: id
        });

    } catch (error) {
        console.error("Delete user error:", error);

        res.status(500).json({
            message: "Failed to delete user."
        });

    }
};

const bcrypt = require("bcryptjs");

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, ward } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: "A user with this email already exists."
            });
        }

        const allowedRoles = ["citizen", "moderator", "admin"];
        const selectedRole = role || "citizen";

        if (!allowedRoles.includes(selectedRole)) {
            return res.status(400).json({
                message: "Invalid role."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: selectedRole,
            ward: ward ? ward.trim() : "",
            isActive: true
        });

        const safeUser = await User.findById(user._id).select("-password");

        res.status(201).json({
            message: "User created successfully.",
            user: safeUser
        });

    } catch (error) {
        console.error("Create user error:", error);

        if (error.code === 11000) {
        return res.status(409).json({
            message: "A user with this email already exists."
        });
        }

        res.status(500).json({
        message: "Failed to create user."
        });

    }
};

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    deleteUser
};
