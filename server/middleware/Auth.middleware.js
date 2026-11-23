import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Session from "../models/Session.js";
export const verifyJWT = async (req, res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Use Authorization: Bearer <token>",
    });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is not configured"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof decoded === "string" || !decoded.id || !decoded.jti) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.id).select("_id");
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const session = await Session.exists({
      tokenId: decoded.jti,
      user: user._id,
      expiresAt: { $gt: new Date() },
    });
    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: "Session expired or logged out" });
    }

    req.user = {
      id: user._id.toString(),
      sessionId: decoded.jti,
    };
    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }
    return next(error);
  }
};
