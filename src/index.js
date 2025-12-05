import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { firebaseAuthMiddleware } from "./firebaseAdmin.js";

import searchRoute from "./routes/search.js";
import bookRoute from "./routes/book.js";
import authorRoute from "./routes/author.js";

import listsRoute from "./routes/lists.js";
import reviewsRoute from "./routes/reviews.js";
import progressRoute from "./routes/progress.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Hello from Tomevio Backend!"));

app.get("/search", searchRoute);
app.get("/book/:id", bookRoute);
app.get("/author/:id", authorRoute);

app.post("/login", (req, res) => {
  res.status(400).json({
    error:
      "Use the Firebase client SDK to sign in. After sign-in, include the ID token in the Authorization header (Bearer <idToken>) when calling protected endpoints.",
  });
});

app.get("/profile", firebaseAuthMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.use("/lists", firebaseAuthMiddleware, listsRoute);
app.use("/reviews", firebaseAuthMiddleware, reviewsRoute);
app.use("/progress", firebaseAuthMiddleware, progressRoute);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.SERVER_ADDR?.split(":")[1] || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Protected endpoints: /lists, /reviews, /progress`);
});
