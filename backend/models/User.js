const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["citizen", "moderator", "admin"],
      default: "citizen"
    },

    ward: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    },

    contributionStats: {
      reportsCount: {
        type: Number,
        default: 0
      },

      votesCount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);