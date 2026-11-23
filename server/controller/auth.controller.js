import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ name, email, password }) {
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !emailPattern.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return "Provide a name, valid email, and password between 8 and 72 UTF-8 bytes";
  }
  return null;
}

async function createAccount({ name, email, password }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
  });
  return user;
}

async function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await Session.create({ tokenId, user: user._id, expiresAt });
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    jwtid: tokenId,
    expiresIn: "1h",
  });
}

function userResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
}

export async function findPasswordMatch(users, password) {
  let match = null;
  for (const user of users) {
    if (await bcrypt.compare(password, user.password)) {
      if (match) return null;
      match = user;
    }
  }
  return match;
}

export async function register(req, res) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  const { name, email, password } = req.body ?? {};
  const validationError = validateRegistration({ name, email, password });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    return res
      .status(409)
      .json({ success: false, message: "An account with this email already exists" });
  }

  const user = await createAccount({ name, email, password });
  const token = await createToken(user);
  return res.status(201).json({
    success: true,
    message: "Registration successful",
    token,
    user: userResponse(user),
  });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Provide email and password" });
  }

  const users = await User.find({ email: email.trim().toLowerCase() }).select(
    "+password",
  );
  const user = await findPasswordMatch(users, password);
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid email or password" });
  }

  return res.json({
    success: true,
    message: "Login successful",
    token: await createToken(user),
    user: userResponse(user),
  });
}

export async function logout(req, res) {
  await Session.deleteOne({ tokenId: req.user.sessionId, user: req.user.id });
  return res.json({ success: true, message: "Logged out successfully" });
}