import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps || admin.apps.length === 0) {
  let cert = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      cert = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", err);
    }
  } else if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    cert = {
      project_id: process.env.FIREBASE_PROJECT_ID || "tomevio",
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  try {
    if (cert) {
      admin.initializeApp({
        credential: admin.credential.cert(cert),
      });
      console.log("Firebase Admin initialized with provided service account.");
    } else {
      admin.initializeApp();
      console.warn(
        "Firebase Admin initialized with default credentials. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for explicit credentials.",
      );
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin SDK:", err);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function firebaseAuthMiddleware(req, res, next) {
  try {
    if (!auth) {
      return res.status(500).json({ error: "Firebase auth not initialized" });
    }

    const header =
      req.headers?.authorization ||
      req.headers?.Authorization ||
      (typeof req.get === "function" ? req.get("Authorization") : undefined);

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        error:
          "Unauthorized. Please provide a valid Firebase ID token in the Authorization header.",
      });
    }

    const idToken = header.split("Bearer ")[1].trim();
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized. Missing ID token." });
    }

    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    return res.status(401).json({
      error: "Invalid or expired token. Please sign in again.",
    });
  }
}

async function verifyIdToken(idToken) {
  if (!auth) throw new Error("Firebase auth not initialized");
  return auth.verifyIdToken(idToken);
}

export { admin, db, auth, firebaseAuthMiddleware, verifyIdToken };
