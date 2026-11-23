import bcrypt from "bcrypt";
import User from "../models/User.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function profileResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(req, res) {
  const user = await User.findById(req.user.id).select("name email createdAt updatedAt");
  if (!user) {
    return res.status(404).json({ success: false, message: "Profile not found" });
  }
  return res.json({ success: true, user: profileResponse(user) });
}

export async function updateProfile(req, res) {
  const { name, email, currentPassword, newPassword } = req.body ?? {};
  const updates = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name cannot be empty" });
    }
    updates.name = name.trim();
  }
  if (email !== undefined) {
    if (typeof email !== "string" || !emailPattern.test(email.trim())) {
      return res.status(400).json({ success: false, message: "Provide a valid email" });
    }
    updates.email = email.trim().toLowerCase();
  }
  if (newPassword !== undefined) {
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide your current password and a new password between 8 and 72 UTF-8 bytes",
      });
    }
  }
  if (!Object.keys(updates).length && newPassword === undefined) {
    return res.status(400).json({ success: false, message: "Provide profile fields to update" });
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!user) {
    return res.status(404).json({ success: false, message: "Profile not found" });
  }
  if (updates.email && updates.email !== user.email) {
    if (await User.exists({ email: updates.email, _id: { $ne: user._id } })) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
  }

  Object.assign(user, updates);
  if (newPassword !== undefined) {
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
  }
  await user.save();
  return res.json({
    success: true,
    message: "Profile updated",
    user: profileResponse(user),
  });
}
