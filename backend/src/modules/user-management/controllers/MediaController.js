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

  // Extract bucket + path from a Supabase storage URL.
  // Example: https://xyz.supabase.co/storage/v1/object/public/post-media/posts/userid/file.png
  // We also support already-signed URLs by returning the original.
  const marker = "/storage/v1/object/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const after = url.slice(idx + marker.length); // e.g. public/<bucket>/<path...>
  const parts = after.split("/");
  if (parts.length < 3) return null;

  const visibilitySegment = parts[0];
  if (visibilitySegment === "sign") {
    // Already a signed URL (likely expired eventually, but keep as-is)
    return url;
  }

  const bucket = parts[1];
  const objectPath = parts.slice(2).join("/");
  if (!bucket || !objectPath) return null;

  // Sign for 1 hour. Works for both public and private buckets.
  const { createClient } = await import("@supabase/supabase-js");
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminSupabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

const MediaController = {
  async uploadPostMedia(req, res) {
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

      const bucket = process.env.POST_MEDIA_BUCKET || "profile-images";
      const sanitizedName = String(req.file.originalname || "upload")
        .replaceAll("..", "")
        .replaceAll("/", "-")
        .replaceAll("\\", "-")
        .replace(/[^a-zA-Z0-9_.-]/g, "_");

      const objectPath = `posts/${userId}/${Date.now()}-${sanitizedName}`;

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
      console.log("💥 uploadPostMedia exception:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async createPost(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    const { content, media_url, media_type, visibility } = req.body || {};

    if (!content && !media_url) {
      return res.status(400).json({ error: "Post must have content or media" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      const { data, error: insertError } = await authed
        .from("posts")
        .insert([
          {
            user_id: userId,
            content: content || "",
            media_url: media_url || null,
            media_type: media_type || null,
            visibility: visibility || "friends",
          },
        ])
        .select("post_id, user_id, content, media_url, media_type, created_at")
        .single();

      if (insertError) {
        if (insertError.code === "42P01") {
          return res.status(500).json({ error: "posts table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: insertError.message });
      }

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getFeed(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      const { data: posts, error: postsError } = await authed
        .from("posts")
        .select("post_id, user_id, content, media_url, media_type, visibility, is_collaborative, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) {
        if (postsError.code === "42P01") {
          return res.status(500).json({ error: "posts table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: postsError.message });
      }

      const postIds = (posts || []).map((p) => p.post_id);
      const authorIds = Array.from(new Set((posts || []).map((p) => p.user_id)));

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

      // Likes + my-liked
      const likeCounts = {};
      const likedByMe = {};
      if (postIds.length > 0) {
        const { data: likes, error: likesError } = await authed
          .from("post_likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        if (!likesError) {
          for (const like of likes || []) {
            likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1;
            if (like.user_id === userId) likedByMe[like.post_id] = true;
          }
        }
      }

      // Comments count
      const commentCounts = {};
      if (postIds.length > 0) {
        const { data: comments, error: commentsError } = await authed
          .from("post_comments")
          .select("post_id")
          .in("post_id", postIds);

        if (!commentsError) {
          for (const c of comments || []) {
            commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
          }
        }
      }

      const hydrated = [];
      for (const p of posts || []) {
        const signed = p.media_url ? await tryCreateSignedMediaUrl(p.media_url) : null;

        hydrated.push({
          ...p,
          media_url: signed || p.media_url,
          author: profilesByUserId[p.user_id] || null,
          like_count: likeCounts[p.post_id] || 0,
          comment_count: commentCounts[p.post_id] || 0,
          liked_by_me: Boolean(likedByMe[p.post_id]),
        });
      }

      return res.json({ data: hydrated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async toggleLike(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { postId } = req.params;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const authed = await createAuthenticatedClient(token);

      const { data: existing, error: existingError } = await authed
        .from("post_likes")
        .select("post_id, user_id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        if (existingError.code === "42P01") {
          return res.status(500).json({ error: "post_likes table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: existingError.message });
      }

      if (existing) {
        const { error: delError } = await authed
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (delError) return res.status(400).json({ error: delError.message });
        return res.json({ success: true, liked: false });
      }

      const { error: insError } = await authed.from("post_likes").insert([{ post_id: postId, user_id: userId }]);
      if (insError) return res.status(400).json({ error: insError.message });

      return res.json({ success: true, liked: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getComments(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { postId } = req.params;

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      const { data: comments, error: commentsError } = await authed
        .from("post_comments")
        .select("comment_id, post_id, user_id, comment_text, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) {
        if (commentsError.code === "42P01") {
          return res.status(500).json({ error: "post_comments table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: commentsError.message });
      }

      const authorIds = Array.from(new Set((comments || []).map((c) => c.user_id)));
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

      const hydrated = (comments || []).map((c) => ({ ...c, author: profilesByUserId[c.user_id] || null }));
      return res.json({ data: hydrated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async addComment(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { postId } = req.params;
    const { comment_text } = req.body || {};

    const { userId, error } = await getUserIdFromToken(supabase, token);
    if (!userId) {
      return res.status(401).json({ error: error || "Unauthorized" });
    }

    if (!comment_text || !String(comment_text).trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    try {
      const authed = await createAuthenticatedClient(token);
      const { data, error: insertError } = await authed
        .from("post_comments")
        .insert([{ post_id: postId, user_id: userId, comment_text: String(comment_text).trim() }])
        .select("comment_id, post_id, user_id, comment_text, created_at")
        .single();

      if (insertError) {
        if (insertError.code === "42P01") {
          return res.status(500).json({ error: "post_comments table is missing. Apply schema changes first." });
        }
        return res.status(400).json({ error: insertError.message });
      }

      const { data: profile } = await authed
        .from("user_profiles")
        .select("user_id, full_name, username, profile_photo_url")
        .eq("user_id", userId)
        .maybeSingle();

      return res.json({
        success: true,
        data: {
          ...data,
          author: profile
            ? { full_name: profile.full_name, username: profile.username, profile_photo_url: profile.profile_photo_url }
            : null,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};

export default MediaController;
