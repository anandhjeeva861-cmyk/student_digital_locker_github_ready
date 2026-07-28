const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "student-digital-locker-dev-secret";

function signToken(profile) {
  return jwt.sign({ sub: profile.id, role: profile.role }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, _res, next) {
  const header = req.headers.authorization || "";
  const requestToken = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;
  if (!requestToken) {
    const error = new Error("Authentication required.");
    error.status = 401;
    return next(error);
  }

  try {
    const payload = jwt.verify(requestToken, JWT_SECRET);
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(payload.sub);
    if (!profile) {
      const error = new Error("Profile not found.");
      error.status = 401;
      return next(error);
    }
    req.user = profile;
    next();
  } catch {
    const error = new Error("Invalid or expired session.");
    error.status = 401;
    next(error);
  }
}

function roleRequired(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role) {
      const error = new Error("Access denied.");
      error.status = 403;
      return next(error);
    }
    next();
  };
}

module.exports = { authRequired, roleRequired, signToken };
