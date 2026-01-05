import express from "express";
import { db, admin, firebaseAuthMiddleware } from "../firebaseAdmin.js";

const router = express.Router();

function profileToDTO(id, data) {
  return {
    id,
    username: data.username || null,
    displayName: data.displayName || data.name || null,
    bio: data.bio || null,
    avatar: data.avatar || null,
    followersCount:
      typeof data.followersCount === "number" ? data.followersCount : null,
    followingCount:
      typeof data.followingCount === "number" ? data.followingCount : null,
  };
}

function followEdgeToDTO(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    userId: d.userId,
    followerId: d.followerId,
    createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null,
  };
}

async function findUserProfileByUsername(username) {
  const q = db
    .collection("userProfiles")
    .where("username", "==", username)
    .limit(1);
  const snap = await q.get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() };
}

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const profile = await findUserProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: "User not found" });

    res.json({ profile: profileToDTO(profile.id, profile.data) });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.post("/profile", firebaseAuthMiddleware, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      username,
      displayName = null,
      bio = null,
      avatar = null,
    } = req.body || {};

    if (username && typeof username !== "string") {
      return res.status(400).json({ error: "Invalid `username`" });
    }

    if (username) {
      const q = db
        .collection("userProfiles")
        .where("username", "==", username)
        .limit(1);
      const snap = await q.get();
      if (!snap.empty) {
        const found = snap.docs[0];
        if (found.id !== uid) {
          return res.status(409).json({ error: "Username already taken" });
        }
      }
    }

    const ref = db.collection("userProfiles").doc(uid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? snap.data() : {};
      const followersCount =
        typeof existing.followersCount === "number"
          ? existing.followersCount
          : 0;
      const followingCount =
        typeof existing.followingCount === "number"
          ? existing.followingCount
          : 0;

      const data = {
        username: username ? String(username) : existing.username || null,
        displayName:
          displayName !== undefined
            ? displayName
            : existing.displayName || existing.name || null,
        bio: bio !== undefined ? bio : existing.bio || null,
        avatar: avatar !== undefined ? avatar : existing.avatar || null,
        followersCount,
        followingCount,
        updatedAt: now,
      };

      if (!snap.exists) {
        data.createdAt = now;
      }

      tx.set(ref, data, { merge: true });
    });

    const created = await ref.get();
    res.status(201).json({ profile: profileToDTO(created.id, created.data()) });
  } catch (err) {
    console.error("Error creating/updating profile:", err);
    res.status(500).json({ error: "Failed to create or update profile" });
  }
});

router.post("/:username/follow", firebaseAuthMiddleware, async (req, res) => {
  try {
    const followerId = req.user?.uid;
    if (!followerId) return res.status(401).json({ error: "Unauthorized" });

    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const target = await findUserProfileByUsername(username);
    if (!target) return res.status(404).json({ error: "User not found" });

    const targetId = target.id;
    if (targetId === followerId)
      return res.status(400).json({ error: "Cannot follow yourself" });

    const edgeId = `${targetId}_${followerId}`;
    const edgeRef = db.collection("followers").doc(edgeId);
    const targetProfileRef = db.collection("userProfiles").doc(targetId);
    const followerProfileRef = db.collection("userProfiles").doc(followerId);

    await db.runTransaction(async (tx) => {
      const edgeSnap = await tx.get(edgeRef);
      if (edgeSnap.exists) {
        throw { status: 409, message: "Already following" };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(edgeRef, {
        userId: targetId,
        followerId,
        createdAt: now,
      });

      const targetSnap = await tx.get(targetProfileRef);
      const followerSnap = await tx.get(followerProfileRef);

      const targetData = targetSnap.exists ? targetSnap.data() : {};
      const followerData = followerSnap.exists ? followerSnap.data() : {};

      const newTargetFollowers =
        (typeof targetData.followersCount === "number"
          ? targetData.followersCount
          : 0) + 1;
      const newFollowerFollowing =
        (typeof followerData.followingCount === "number"
          ? followerData.followingCount
          : 0) + 1;

      tx.set(
        targetProfileRef,
        { followersCount: newTargetFollowers, updatedAt: now },
        { merge: true },
      );
      tx.set(
        followerProfileRef,
        { followingCount: newFollowerFollowing, updatedAt: now },
        { merge: true },
      );
    });

    const createdEdge = await edgeRef.get();
    res.status(201).json({ follow: followEdgeToDTO(createdEdge) });
  } catch (err) {
    console.error("Error following user:", err);
    if (err && err.status === 409)
      return res.status(409).json({ error: err.message });
    res.status(500).json({ error: "Failed to follow user" });
  }
});

router.delete("/:username/follow", firebaseAuthMiddleware, async (req, res) => {
  try {
    const followerId = req.user?.uid;
    if (!followerId) return res.status(401).json({ error: "Unauthorized" });

    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const target = await findUserProfileByUsername(username);
    if (!target) return res.status(404).json({ error: "User not found" });

    const targetId = target.id;
    const edgeId = `${targetId}_${followerId}`;
    const edgeRef = db.collection("followers").doc(edgeId);
    const targetProfileRef = db.collection("userProfiles").doc(targetId);
    const followerProfileRef = db.collection("userProfiles").doc(followerId);

    await db.runTransaction(async (tx) => {
      const edgeSnap = await tx.get(edgeRef);
      if (!edgeSnap.exists) {
        throw { status: 404, message: "Follow edge not found" };
      }

      tx.delete(edgeRef);

      const targetSnap = await tx.get(targetProfileRef);
      const followerSnap = await tx.get(followerProfileRef);

      const targetData = targetSnap.exists ? targetSnap.data() : {};
      const followerData = followerSnap.exists ? followerSnap.data() : {};

      const newTargetFollowers = Math.max(
        0,
        (typeof targetData.followersCount === "number"
          ? targetData.followersCount
          : 0) - 1,
      );
      const newFollowerFollowing = Math.max(
        0,
        (typeof followerData.followingCount === "number"
          ? followerData.followingCount
          : 0) - 1,
      );

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(
        targetProfileRef,
        { followersCount: newTargetFollowers, updatedAt: now },
        { merge: true },
      );
      tx.set(
        followerProfileRef,
        { followingCount: newFollowerFollowing, updatedAt: now },
        { merge: true },
      );
    });

    res.status(204).end();
  } catch (err) {
    console.error("Error unfollowing user:", err);
    if (err && err.status === 404)
      return res.status(404).json({ error: err.message });
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

router.get("/:username/activity", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const profile = await findUserProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: "User not found" });

    const userId = profile.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const reviewsQ = db
      .collection("reviews")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit);
    const reviewsSnap = await reviewsQ.get();
    const reviews = reviewsSnap.docs.map((d) => {
      const data = d.data();
      return {
        type: "review",
        id: d.id,
        bookId: data.bookId,
        bookTitle: data.bookTitle || null,
        rating: typeof data.rating === "number" ? data.rating : null,
        reviewText: data.reviewText || null,
        createdAt: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    const progressQ = db
      .collection("readingProgress")
      .where("userId", "==", userId)
      .orderBy("updatedAt", "desc")
      .limit(limit);
    const progressSnap = await progressQ.get();
    const progresses = progressSnap.docs.map((d) => {
      const data = d.data();
      return {
        type: "progress",
        id: d.id,
        bookId: data.bookId,
        bookTitle: data.bookTitle || null,
        status: data.status || null,
        currentPage:
          typeof data.currentPage === "number" ? data.currentPage : null,
        totalPages:
          typeof data.totalPages === "number" ? data.totalPages : null,
        updatedAt: data.updatedAt
          ? data.updatedAt.toDate().toISOString()
          : null,
        createdAt: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    const listsQ = db
      .collection("lists")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit);
    const listsSnap = await listsQ.get();
    const lists = listsSnap.docs.map((d) => {
      const data = d.data();
      return {
        type: "list",
        id: d.id,
        name: data.name,
        description: data.description || null,
        books: Array.isArray(data.books) ? data.books : [],
        createdAt: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    const combined = [
      ...reviews.map((r) => ({ ts: r.createdAt, item: r })),
      ...progresses.map((p) => ({ ts: p.updatedAt || p.createdAt, item: p })),
      ...lists.map((l) => ({ ts: l.createdAt, item: l })),
    ]
      .filter((x) => x.ts)
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
      .slice(0, limit)
      .map((x) => x.item);

    res.json({ activities: combined });
  } catch (err) {
    console.error("Error fetching activity feed:", err);
    res.status(500).json({ error: "Failed to fetch activity feed" });
  }
});

router.get("/:username/followers", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const profile = await findUserProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: "User not found" });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const q = db
      .collection("followers")
      .where("userId", "==", profile.id)
      .orderBy("createdAt", "desc")
      .limit(limit);

    const snap = await q.get();
    const edges = snap.docs.map(followEdgeToDTO);

    const followerIds = edges.map((e) => e.followerId).filter(Boolean);
    let followerProfilesMap = {};
    if (followerIds.length > 0) {
      const profileSnaps = await db
        .collection("userProfiles")
        .where("__name__", "in", followerIds.slice(0, 10))
        .get()
        .catch(() => ({ empty: true }));
      if (!profileSnaps.empty) {
        profileSnaps.docs.forEach((d) => {
          followerProfilesMap[d.id] = d.data();
        });
      }
    }

    const followers = edges.map((e) => ({
      ...e,
      profile:
        followerProfilesMap[e.followerId] != null
          ? profileToDTO(e.followerId, followerProfilesMap[e.followerId])
          : null,
    }));

    res.json({ followers, count: snap.size });
  } catch (err) {
    console.error("Error fetching followers:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

router.get("/:username/following", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: "Missing username" });

    const profile = await findUserProfileByUsername(username);
    if (!profile) return res.status(404).json({ error: "User not found" });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const q = db
      .collection("followers")
      .where("followerId", "==", profile.id)
      .orderBy("createdAt", "desc")
      .limit(limit);

    const snap = await q.get();
    const edges = snap.docs.map(followEdgeToDTO);

    const targetIds = edges.map((e) => e.userId).filter(Boolean);
    let targetProfilesMap = {};
    if (targetIds.length > 0) {
      const profileSnaps = await db
        .collection("userProfiles")
        .where("__name__", "in", targetIds.slice(0, 10))
        .get()
        .catch(() => ({ empty: true }));
      if (!profileSnaps.empty) {
        profileSnaps.docs.forEach((d) => {
          targetProfilesMap[d.id] = d.data();
        });
      }
    }

    const following = edges.map((e) => ({
      ...e,
      profile:
        targetProfilesMap[e.userId] != null
          ? profileToDTO(e.userId, targetProfilesMap[e.userId])
          : null,
    }));

    res.json({ following, count: snap.size });
  } catch (err) {
    console.error("Error fetching following:", err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

export default router;
