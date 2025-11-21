import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import searchRoute from "./routes/search.js";
import bookRoute from "./routes/book.js";
import authorRoute from "./routes/author.js";
import { loginHandler, getInfoHandler } from "./controller/auth.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Hello, World!"));
app.get("/search", searchRoute);
app.get("/book/:id", bookRoute);
app.get("/author/:id", authorRoute);

app.post("/login", loginHandler);
app.get("/profile", getInfoHandler);

const PORT = process.env.SERVER_ADDR?.split(":")[1] || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
