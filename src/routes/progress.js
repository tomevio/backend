import express from "express";
import { db, admin, firebaseAuthMiddleware } from "../firebaseAdmin.js";

const router = express.Router();

const VALID_STATUSES = new Set(["want-to-read", "reading", "completed", "dnf"]);

function progressToDTO(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    bookId: data.bookId,
    bookTitle: data.bookTitle || null,
    authorName: data.authorName || null,
    cover: data.cover ?? null,
    currentPage: typeof data.currentPage === "number" ? data.currentPage : null,
    totalPages: typeof data.totalPages === "number" ? data.totalPages : null,
    status: data.status || null,
    startDate: data.startDate ? data.startDate.toDate().toISOString() : null,
    finishDate: data.finishDate ? data.finishDate.toDate().toISOString() : null,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const q = db
      .collection("readingProgress")
      .where("userId", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(500);
    const snap = await q.get();

    const items = snap.docs.map(progressToDTO);
    res.json({ items });
  } catch (err) {
    console.error("Error fetching progress:", err);
    res.status(500).json({ error: "Failed to fetch reading progress" });
  }
});

router.get("/:bookId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { bookId } = req.params;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const docId = `${uid}_${encodeURIComponent(bookId)}`;
    const doc = await db.collection("readingProgress").doc(docId).get();

    if (!doc.exists)
      return res.status(404).json({ error: "Progress not found" });

    res.json({ progress: progressToDTO(doc) });
  } catch (err) {
    console.error("Error fetching progress for book:", err);
    res.status(500).json({ error: "Failed to fetch reading progress" });
  }
});

router.post("/", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      bookId,
      bookTitle = null,
      authorName = null,
      cover = null,
      currentPage = null,
      totalPages = null,
      status = null,
      startDate = null,
      finishDate = null,
    } = req.body || {};

    if (!bookId || typeof bookId !== "string") {
      return res.status(400).json({ error: "Missing or invalid bookId" });
    }

    if (status !== null && !VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${Array.from(VALID_STATUSES).join(", ")}`,
      });
    }

    const docId = `${uid}_${encodeURIComponent(bookId)}`;
    const ref = db.collection("readingProgress").doc(docId);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const docData = {
      userId: uid,
      bookId,
      bookTitle: bookTitle ? String(bookTitle) : null,
      authorName: authorName ? String(authorName) : null,
      cover: cover ?? null,
      currentPage: typeof currentPage === "number" ? currentPage : null,
      totalPages: typeof totalPages === "number" ? totalPages : null,
      status: status || "want-to-read",
      startDate: null,
      finishDate: null,
      createdAt: now,
      updatedAt: now,
    };

    if (startDate) {
      const sd = new Date(startDate);
      if (!isNaN(sd))
        docData.startDate = admin.firestore.Timestamp.fromDate(sd);
    }
    if (finishDate) {
      const fd = new Date(finishDate);
      if (!isNaN(fd))
        docData.finishDate = admin.firestore.Timestamp.fromDate(fd);
    }

    if (docData.status === "reading" && !docData.startDate) {
      docData.startDate = admin.firestore.FieldValue.serverTimestamp();
    }

    if (docData.status === "completed" && !docData.finishDate) {
      docData.finishDate = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.set(docData, { merge: true });

    const created = await ref.get();
    res.status(201).json({ progress: progressToDTO(created) });
  } catch (err) {
    console.error("Error creating/updating progress:", err);
    res
      .status(500)
      .json({ error: "Failed to create or update reading progress" });
  }
});

router.patch("/:bookId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { bookId } = req.params;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const updates = {};
    const allowed = [
      "currentPage",
      "totalPages",
      "status",
      "bookTitle",
      "authorName",
      "cover",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.status && !VALID_STATUSES.has(updates.status)) {
      return res.status(400).json({
        error: `Invalid status. Valid values: ${Array.from(VALID_STATUSES).join(", ")}`,
      });
    }

    const docId = `${uid}_${encodeURIComponent(bookId)}`;
    const ref = db.collection("readingProgress").doc(docId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw { code: 404, message: "Progress not found" };

      const data = snap.data();
      if (data.userId !== uid) throw { code: 403, message: "Forbidden" };

      const updatePayload = {};
      if ("currentPage" in updates) {
        const cp = updates.currentPage;
        updatePayload.currentPage = typeof cp === "number" ? cp : null;
      }
      if ("totalPages" in updates) {
        const tp = updates.totalPages;
        updatePayload.totalPages = typeof tp === "number" ? tp : null;
      }
      if ("bookTitle" in updates)
        updatePayload.bookTitle = updates.bookTitle
          ? String(updates.bookTitle)
          : null;
      if ("authorName" in updates)
        updatePayload.authorName = updates.authorName
          ? String(updates.authorName)
          : null;
      if ("cover" in updates) updatePayload.cover = updates.cover ?? null;

      if ("status" in updates) {
        const newStatus = updates.status;
        const prevStatus = data.status || "want-to-read";
        updatePayload.status = newStatus;

        if (newStatus === "reading" && !data.startDate) {
          updatePayload.startDate =
            admin.firestore.FieldValue.serverTimestamp();
        }

        if (newStatus === "completed" && !data.finishDate) {
          updatePayload.finishDate =
            admin.firestore.FieldValue.serverTimestamp();
        }

        if (prevStatus === "completed" && newStatus !== "completed") {
          updatePayload.finishDate = null;
        }
      }

      updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      tx.update(ref, updatePayload);
    });

    const updated = await ref.get();
    res.json({ progress: progressToDTO(updated) });
  } catch (err) {
    console.error("Error updating progress:", err);
    if (err && err.code === 404)
      return res.status(404).json({ error: err.message });
    if (err && err.code === 403)
      return res.status(403).json({ error: "Forbidden" });
    res.status(500).json({ error: "Failed to update reading progress" });
  }
});

router.delete("/:bookId", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { bookId } = req.params;
    if (!bookId) return res.status(400).json({ error: "Missing bookId" });

    const docId = `${uid}_${encodeURIComponent(bookId)}`;
    const ref = db.collection("readingProgress").doc(docId);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: "Progress not found" });

    const data = doc.data();
    if (data.userId !== uid)
      return res.status(403).json({ error: "Forbidden" });

    await ref.delete();
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting progress:", err);
    res.status(500).json({ error: "Failed to delete reading progress" });
  }
});

router.get("/stats/summary", async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const q = db.collection("readingProgress").where("userId", "==", uid);
    const snap = await q.get();

    const stats = {
      wantToRead: 0,
      currentlyReading: 0,
      completed: 0,
      dnf: 0,
      totalPagesSum: 0,
      totalCurrentPages: 0,
      entries: snap.size,
    };

    snap.forEach((doc) => {
      const d = doc.data();
      const status = d.status || "want-to-read";
      if (status === "want-to-read") stats.wantToRead += 1;
      else if (status === "reading") stats.currentlyReading += 1;
      else if (status === "completed") stats.completed += 1;
      else if (status === "dnf") stats.dnf += 1;

      if (typeof d.totalPages === "number") stats.totalPagesSum += d.totalPages;
      if (typeof d.currentPage === "number")
        stats.totalCurrentPages += d.currentPage;
    });

    res.json({ stats });
  } catch (err) {
    console.error("Error computing progress stats:", err);
    res.status(500).json({ error: "Failed to compute progress statistics" });
  }
});

export default router;
