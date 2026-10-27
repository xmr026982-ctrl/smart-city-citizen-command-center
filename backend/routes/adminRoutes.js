const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    deleteUser
} = require("../controllers/adminController");

const router = express.Router();

// Every route below requires admin authentication.
router.use(protect, authorizeRoles("admin"));

router.post("/users", createUser);

// GET /api/admin/users
router.get("/users", getUsers);

// GET /api/admin/users/:id
router.get("/users/:id", getUserById);

// PATCH /api/admin/users/:id
router.patch("/users/:id", updateUser);

// PATCH /api/admin/users/:id/status
router.patch("/users/:id/status", updateUserStatus);

// DELETE /api/admin/users/:id
router.delete("/users/:id", deleteUser);

module.exports = router;
