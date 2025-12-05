import express from "express";
import { db, admin, firebaseAuthMiddleware } from "../firebaseAdmin.js";

const router = express.Router();

function reviewToDTO(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    userName: data.userName || null,
    bookId: data.bookId,
    bookTitle: data.bookTitle || null,
    rating: typeof data.rating === "number" ? data.rating : null,
    reviewText: data.reviewText || null,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
  };
}

router.get("/book/:bookId", async (req, res) => {
  const { bookId } = req.params;
  if (!bookId) return res.status(400).json({ error: "Missing bookId" });

  try {
    const q = db
      .collection("reviews")
      .where("bookId", "==", bookId)
      .orderBy("createdAt", "desc")
      .limit(100);
    const snap = await q.get();
    const reviews = snap.docs.map(reviewToDTO);
    res.json({ reviews });
  } catch (err) {
    console.error("Error fetching reviews for book:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.get("/:reviewId", async (req, res) => {
  const { reviewId } = req.params;
  if (!reviewId) return res.status(400).json({ error: "Missing reviewId" });

  try {
    const doc = await db.collection("reviews").doc(reviewId).get();
    if (!doc.exists) return res.status(404).json({ error: "Review not found" });
    res.json({ review: reviewToDTO(doc) });
  } catch (err) {
    console.error("Error fetching review:", err);
    res.status(500).json({ error: "Failed to fetch review" });
  }
});

router.get("/user", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const q = db
      .collection("reviews")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(200);
    const snap = await q.get();
    const reviews = snap.docs.map(reviewToDTO);
    res.json({ reviews });
  } catch (err) {
    console.error("Error fetching user reviews:", err);
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

router.post("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      bookId,
      bookTitle = null,
      rating,
      reviewText = null,
    } = req.body || {};

    if (!bookId || typeof bookId !== "string")
      return res.status(400).json({ error: "Invalid or missing `bookId`" });

    const parsedRating = Number(rating);
    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      return res
        .status(400)
        .json({ error: "`rating` must be an integer between 1 and 5" });
    }

    const docId = `${uid}_${encodeURIComponent(bookId)}`;
    const ref = db.collection("reviews").doc(docId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        throw {
          status: 409,
          message: "Review already exists for this user and book",
        };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const userName =
        req.user?.name || req.user?.displayName || req.user?.email || null;

      tx.set(ref, {
        userId: uid,
        userName,
        bookId,
        bookTitle: bookTitle ? String(bookTitle) : null,
        rating: parsedRating,
        reviewText: reviewText ? String(reviewText) : null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const created = await ref.get();
    res.status(201).json({ review: reviewToDTO(created) });
  } catch (err) {
    console.error("Error creating review:", err);
    if (err && err.status === 409)
      return res.status(409).json({ error: err.message });
    res.status(500).json({ error: "Failed to create review" });
  }
});

router.put("/:reviewId", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { reviewId } = req.params;
    const { rating, reviewText, bookTitle } = req.body || {};

    const ref = db.collection("reviews").doc(reviewId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Review not found" });

    const data = doc.data();
    if (data.userId !== uid)
      return res.status(403).json({ error: "Forbidden" });

    const updates = {};
    if (rating !== undefined) {
      const parsedRating = Number(rating);
      if (
        !Number.isInteger(parsedRating) ||
        parsedRating < 1 ||
        parsedRating > 5
      ) {
        return res
          .status(400)
          .json({ error: "`rating` must be an integer between 1 and 5" });
      }
      updates.rating = parsedRating;
    }
    if (reviewText !== undefined)
      updates.reviewText = reviewText === null ? null : String(reviewText);
    if (bookTitle !== undefined)
      updates.bookTitle = bookTitle === null ? null : String(bookTitle);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await ref.update(updates);
    const updated = await ref.get();
    res.json({ review: reviewToDTO(updated) });
  } catch (err) {
    console.error("Error updating review:", err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

router.delete("/:reviewId", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { reviewId } = req.params;
    const ref = db.collection("reviews").doc(reviewId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Review not found" });

    const data = doc.data();
    if (data.userId !== uid)
      return res.status(403).json({ error: "Forbidden" });

    await ref.delete();
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
