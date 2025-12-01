import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import searchRoute from "./routes/search.js";
import bookRoute from "./routes/book.js";
import authorRoute from "./routes/author.js";

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "tomevio",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const firebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error:
        "Unauthorized. Please provide a valid Firebase ID token in the Authorization header.",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    return res.status(401).json({
      error: "Invalid or expired token. Please sign in again.",
    });
  }
};

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Hello, World!"));

app.get("/search", searchRoute);
app.get("/book/:id", bookRoute);
app.get("/author/:id", authorRoute);

app.post("/login", (req, res) => {
  res.status(400).json({
    error:
      "Use the Firebase client SDK to sign in. After sign-in, include the ID token in the Authorization header (Bearer <idToken>) when calling protected endpoints.",
  });
});

app.get("/profile", firebaseAuth, (req, res) => {
  res.json({ user: req.user });
});

const PORT = process.env.SERVER_ADDR?.split(":")[1] || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
