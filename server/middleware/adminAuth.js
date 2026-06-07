export function adminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({ error: "Admin access is not configured." });
  }
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token !== password) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
