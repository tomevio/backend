import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import searchRoute from "./routes/search.js";
import bookRoute from "./routes/book.js";
import authorRoute from "./routes/author.js";
import cookieParser from "cookie-parser";
import firebaseAuth from "./middleware/firebaseAuth.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

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
