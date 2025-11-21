import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) {
    return admin;
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credential;
  if (serviceAccountEnv) {
    try {
      const obj = JSON.parse(serviceAccountEnv);
      credential = admin.credential.cert(obj);
      console.log(
        "Firebase Admin: initialized from FIREBASE_SERVICE_ACCOUNT env JSON.",
      );
    } catch (err) {
      console.error(
        "Firebase Admin: failed to parse FIREBASE_SERVICE_ACCOUNT JSON:",
        err,
      );
      throw err;
    }
  } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
      const sa = require(serviceAccountPath);
      credential = admin.credential.cert(sa);
      console.log(
        "Firebase Admin: initialized from service account file:",
        serviceAccountPath,
      );
    } catch (err) {
      console.error(
        "Firebase Admin: failed to load service account file:",
        err,
      );
      throw err;
    }
  } else {
    credential = admin.credential.applicationDefault();
    console.log("Firebase Admin: using application default credentials.");
  }

  admin.initializeApp({
    credential,
  });

  return admin;
}

const firebaseAdmin = initFirebaseAdmin();

export async function verifyIdToken(idToken, options = {}) {
  if (!idToken) throw new Error("No Firebase ID token provided.");
  return firebaseAdmin
    .auth()
    .verifyIdToken(idToken, options.checkRevoked || false);
}

export function firebaseAuthMiddleware({ cookieName = "__session" } = {}) {
  return async (req, res, next) => {
    try {
      let idToken = null;

      const authHeader =
        req.headers?.authorization || req.headers?.Authorization;
      if (
        authHeader &&
        typeof authHeader === "string" &&
        authHeader.startsWith("Bearer ")
      ) {
        idToken = authHeader.split("Bearer ")[1].trim();
      } else if (req.cookies && req.cookies[cookieName]) {
        idToken = req.cookies[cookieName];
      } else if (req.body && req.body.idToken) {
        idToken = req.body.idToken;
      }

      if (!idToken) {
        return res
          .status(401)
          .json({ error: "No Firebase ID token provided." });
      }

      const decoded = await verifyIdToken(idToken);
      req.user = decoded;
      return next();
    } catch (err) {
      console.error("Firebase token verification failed:", err);
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export async function createSessionCookie(
  idToken,
  expiresIn = 5 * 24 * 60 * 60 * 1000,
) {
  if (!idToken) throw new Error("No Firebase ID token provided.");
  return firebaseAdmin.auth().createSessionCookie(idToken, { expiresIn });
}

export default firebaseAdmin;
