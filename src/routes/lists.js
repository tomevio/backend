import express from "express";
import { db, admin } from "../firebaseAdmin.js";

const router = express.Router();

function listToDTO(id, data) {
  return {
    id,
    userId: data.userId,
    name: data.name,
    description: data.description || null,
    books: data.books || [],
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const q = db
      .collection("lists")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc");

    const snap = await q.get();
    const lists = [];
    snap.forEach((doc) => {
      lists.push(listToDTO(doc.id, doc.data()));
    });

    res.json({ lists });
  } catch (err) {
    console.error("Error fetching lists:", err);
    res.status(500).json({ error: "Failed to fetch lists" });
  }
});

router.get("/:listId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { listId } = req.params;
    const ref = db.collection("lists").doc(listId);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: "List not found" });

    const data = doc.data();
    if (data.userId !== uid)
      return res.status(403).json({ error: "Forbidden: not your list" });

    res.json({ list: listToDTO(doc.id, data) });
  } catch (err) {
    console.error("Error fetching list:", err);
    res.status(500).json({ error: "Failed to fetch list" });
  }
});

router.post("/", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { name, description } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Invalid or missing `name`" });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const newDoc = {
      userId: uid,
      name: name.trim(),
      description: description ? String(description).trim() : null,
      books: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("lists").add(newDoc);
    const created = await docRef.get();

    res.status(201).json({ list: listToDTO(docRef.id, created.data()) });
  } catch (err) {
    console.error("Error creating list:", err);
    res.status(500).json({ error: "Failed to create list" });
  }
});

router.post("/:listId/books", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { listId } = req.params;
    const { bookId, title, authorName = null, cover = null } = req.body || {};

    if (!bookId || typeof bookId !== "string")
      return res.status(400).json({ error: "Invalid or missing `bookId`" });
    if (!title || typeof title !== "string")
      return res.status(400).json({ error: "Invalid or missing `title`" });

    const ref = db.collection("lists").doc(listId);

    // Use transaction to avoid races
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw { code: 404, message: "List not found" };

      const data = snap.data();
      if (data.userId !== uid) throw { code: 403, message: "Forbidden" };

      const books = Array.isArray(data.books) ? data.books.slice() : [];

      // Prevent duplicate by bookId
      const exists = books.some((b) => b.bookId === bookId);
      if (exists) {
        // nothing to do
        return;
      }

      const entry = {
        bookId,
        title,
        authorName: authorName || null,
        cover: cover ?? null,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      books.push(entry);

      tx.update(ref, {
        books,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const updatedDoc = await ref.get();
    res.status(200).json({ list: listToDTO(updatedDoc.id, updatedDoc.data()) });
  } catch (err) {
    console.error("Error adding book to list:", err);
    if (err && err.code === 404)
      return res.status(404).json({ error: err.message });
    if (err && err.code === 403)
      return res.status(403).json({ error: "Forbidden" });
    res.status(500).json({ error: "Failed to add book to list" });
  }
});

router.delete("/:listId/books/:bookId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { listId, bookId } = req.params;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const ref = db.collection("lists").doc(listId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw { code: 404, message: "List not found" };

      const data = snap.data();
      if (data.userId !== uid) throw { code: 403, message: "Forbidden" };

      const books = Array.isArray(data.books) ? data.books.slice() : [];
      const newBooks = books.filter((b) => b.bookId !== bookId);

      // If nothing changed, just return
      if (newBooks.length === books.length) return;

      tx.update(ref, {
        books: newBooks,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const updatedDoc = await ref.get();
    res.json({ list: listToDTO(updatedDoc.id, updatedDoc.data()) });
  } catch (err) {
    console.error("Error removing book from list:", err);
    if (err && err.code === 404)
      return res.status(404).json({ error: err.message });
    if (err && err.code === 403)
      return res.status(403).json({ error: "Forbidden" });
    res.status(500).json({ error: "Failed to remove book from list" });
  }
});

router.delete("/:listId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { listId } = req.params;
    const ref = db.collection("lists").doc(listId);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: "List not found" });
    const data = doc.data();
    if (data.userId !== uid)
      return res.status(403).json({ error: "Forbidden" });

    await ref.delete();
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting list:", err);
    res.status(500).json({ error: "Failed to delete list" });
  }
});

export default router;
