import express from "express";
import { db } from "../firebaseAdmin.js";

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
