import { verifyIdToken } from "../firebaseAdmin.js";

export function loginHandler(req, res) {
  res.status(400).json({
    error:
      "This backend no longer issues local JWTs. Sign in on the client using Firebase Authentication SDK and include the ID token in the Authorization header (Bearer <idToken>) when calling protected endpoints.",
  });
}

export async function getInfoHandler(req, res) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).end();

  const idToken = auth.replace("Bearer ", "").trim();

  try {
    const decoded = await verifyIdToken(idToken);
    res.json({ message: "Token valid", user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired Firebase ID token" });
  }
}
