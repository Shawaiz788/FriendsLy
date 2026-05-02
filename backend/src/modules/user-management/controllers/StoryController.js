const getSupabase = (req) => req.app.get("supabase");

const createAuthenticatedClient = async (token) => {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const getUserIdFromToken = async (supabase, token) => {
  const safeToken = String(token || "").trim();
  const { data: userData, error: userError } = await supabase.auth.getUser(safeToken);
  if (userError || !userData?.user?.id) {
    return { userId: null, error: userError?.message || "Invalid token" };
  }
  return { userId: userData.user.id, error: null };
};

const tryCreateSignedMediaUrl = async (mediaUrl) => {
  const url = String(mediaUrl || "").trim();
  if (!url) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return null;

  const marker = "/storage/v1/object/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const after = url.slice(idx + marker.length);
  const parts = after.split("/");
  if (parts.length < 3) return null;

  const visibilitySegment = parts[0];
  if (visibilitySegment === "sign") {
    return url;
  }

  const bucket = parts[1];
  const objectPath = parts.slice(2).join("/");
  if (!bucket || !objectPath) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminSupabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

const StoryController = {
  async uploadStoryMedia(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        return res.status(500).json({
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY in backend env. Add it to backend/.env and restart the backend.",
        });
      }

      const { createClient } = await import("@supabase/supabase-js");
      const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

      const bucket = process.env.STORY_MEDIA_BUCKET || "profile-images";
      const sanitizedName = String(req.file.originalname || "upload")
        .replaceAll("..", "")
        .replaceAll("/", "-")
        .replaceAll("\\", "-")
        .replace(/[^a-zA-Z0-9_.-]/g, "_");

      const objectPath = `stories/${userId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await adminSupabase.storage.from(bucket).upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

      if (uploadError) {
        const msg = String(uploadError.message || "");
        if (msg.toLowerCase().includes("invalid compact jws")) {
          return res.status(500).json({
            error:
              "Storage auth failed (Invalid Compact JWS). Update backend SUPABASE_SERVICE_ROLE_KEY to the current project API service_role key (it changes when JWT is rotated).",
          });
        }
        return res.status(400).json({ error: msg || "Storage upload failed" });
      }

      const { data: publicUrlData } = adminSupabase.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        return res.status(400).json({ error: "Failed to get public URL" });
      }

      const mediaType = req.file.mimetype?.startsWith("video/") ? "video" : "image";
      return res.json({ url: publicUrl, bucket, path: objectPath, media_type: mediaType });
    } catch (err) {
      console.log("💥 uploadStoryMedia exception:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async createStory(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    const { media_url, media_type, visibility } = req.body || {};

    if (!media_url) {
      return res.status(400).json({ error: "Story must have media" });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({ error: "Media type must be 'image' or 'video'" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      
      // Set expiration to 24 hours from now
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const { data, error: insertError } = await authed
        .from("stories")
        .insert([
          {
            user_id: userId,
            media_url: media_url,
            media_type: media_type,
            visibility: visibility || "friends",
            expires_at: expiresAt.toISOString(),
          },
        ])
        .select("story_id, user_id, media_url, media_type, visibility, created_at, expires_at")
        .single();

      if (insertError) {
        if (insertError.code === "42P01") {
          return res.status(500).json({ error: "stories table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: insertError.message });
      }

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getStories(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      
      // Get stories that are not expired
      const now = new Date().toISOString();
      const { data: stories, error: storiesError } = await authed
        .from("stories")
        .select("story_id, user_id, media_url, media_type, visibility, created_at, expires_at")
        .gte("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(50);

      if (storiesError) {
        if (storiesError.code === "42P01") {
          return res.status(500).json({ error: "stories table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: storiesError.message });
      }

      const storyIds = (stories || []).map((s) => s.story_id);
      const authorIds = Array.from(new Set((stories || []).map((s) => s.user_id)));

      // Authors
      let profilesByUserId = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await authed
          .from("user_profiles")
          .select("user_id, full_name, username, profile_photo_url")
          .in("user_id", authorIds);

        profilesByUserId = Object.fromEntries(
          (profiles || []).map((p) => [p.user_id, { full_name: p.full_name, username: p.username, profile_photo_url: p.profile_photo_url }]),
        );
      }

      const hydrated = [];
      for (const s of stories || []) {
        const signed = s.media_url ? await tryCreateSignedMediaUrl(s.media_url) : null;

        hydrated.push({
          ...s,
          media_url: signed || s.media_url,
          author: profilesByUserId[s.user_id] || null,
        });
      }

      return res.json({ data: hydrated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async deleteStory(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { storyId } = req.params;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      
      // First check if the story belongs to the user
      const { data: story, error: fetchError } = await authed
        .from("stories")
        .select("story_id, user_id")
        .eq("story_id", storyId)
        .maybeSingle();

      if (fetchError) {
        return res.status(400).json({ error: fetchError.message });
      }

      if (!story) {
        return res.status(404).json({ error: "Story not found" });
      }

      if (story.user_id !== userId) {
        return res.status(403).json({ error: "You can only delete your own stories" });
      }

      // Delete the story
      const { error: deleteError } = await authed
        .from("stories")
        .delete()
        .eq("story_id", storyId);

      if (deleteError) {
        return res.status(400).json({ error: deleteError.message });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};

export default StoryController;