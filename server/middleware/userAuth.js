import { verifyUserToken } from "../utils/supabase.js";

export async function userAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }
  const user = await verifyUserToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
  req.user = user;
  next();
}

export async function optionalUserAuth(req, _res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const user = await verifyUserToken(token);
    if (user) req.user = user;
  }
  next();
}
