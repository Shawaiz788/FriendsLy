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

const profileFields = "user_id, full_name, username, profile_photo_url";

const getProfilesByUserId = async (supabase, userIds) => {
  const uniqueUserIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (uniqueUserIds.length === 0) return {};

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select(profileFields)
    .in("user_id", uniqueUserIds);

  if (error) {
    console.error("Fetch profiles error:", error);
    return {};
  }

  return Object.fromEntries(
    (profiles || []).map((profile) => [
      profile.user_id,
      {
        full_name: profile.full_name,
        username: profile.username,
        profile_photo_url: profile.profile_photo_url,
      },
    ])
  );
};

const hydrateCollaborativePosts = async (supabase, posts) => {
  const postRows = posts || [];
  if (postRows.length === 0) return [];

  const postIds = postRows.map((post) => post.post_id).filter(Boolean);
  const authorIds = postRows.map((post) => post.user_id).filter(Boolean);

  const [{ data: collaborators }, { data: likes }, { data: comments }] = await Promise.all([
    supabase.from("post_collaborators").select("post_id, user_id").in("post_id", postIds),
    supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("post_comments").select("comment_id, post_id, comment_text, user_id, created_at").in("post_id", postIds),
  ]);

  const profileIds = [
    ...authorIds,
    ...(collaborators || []).map((collaborator) => collaborator.user_id),
    ...(comments || []).map((comment) => comment.user_id),
  ];
  const profilesByUserId = await getProfilesByUserId(supabase, profileIds);

  const collaboratorsByPostId = {};
  for (const collaborator of collaborators || []) {
    const list = collaboratorsByPostId[collaborator.post_id] || [];
    list.push({
      user_id: collaborator.user_id,
      user_profiles: profilesByUserId[collaborator.user_id] || null,
    });
    collaboratorsByPostId[collaborator.post_id] = list;
  }

  const likesByPostId = {};
  for (const like of likes || []) {
    const list = likesByPostId[like.post_id] || [];
    list.push({ user_id: like.user_id });
    likesByPostId[like.post_id] = list;
  }

  const commentsByPostId = {};
  for (const comment of comments || []) {
    const list = commentsByPostId[comment.post_id] || [];
    list.push({
      comment_id: comment.comment_id,
      content: comment.comment_text,
      user_id: comment.user_id,
      created_at: comment.created_at,
      user_profiles: profilesByUserId[comment.user_id] || null,
    });
    commentsByPostId[comment.post_id] = list;
  }

  return postRows.map((post) => ({
    ...post,
    user_profiles: profilesByUserId[post.user_id] || null,
    post_collaborators: collaboratorsByPostId[post.post_id] || [],
    post_likes: likesByPostId[post.post_id] || [],
    post_comments: commentsByPostId[post.post_id] || [],
  }));
};

// Create a new collaborative post
export const createCollaborativePost = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { content, media_url, media_type, visibility, collaborators } = req.body;
    
    if (!content && !media_url) {
      return res.status(400).json({ error: "Content or media is required" });
    }

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    // Create the post
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .insert([{
        user_id: userId,
        content,
        media_url,
        media_type,
        visibility: visibility || "friends",
        is_collaborative: true,
      }])
      .select()
      .single();

    if (postError) {
      console.error("Post creation error:", postError);
      return res.status(500).json({ error: "Failed to create post" });
    }

    // Add collaborators
    if (collaborators && collaborators.length > 0) {
      const collaboratorData = collaborators.map(collaboratorId => ({
        post_id: postData.post_id,
        user_id: collaboratorId,
      }));

      // Add the creator as a collaborator too
      collaboratorData.push({
        post_id: postData.post_id,
        user_id: userId,
      });

      const { error: collaboratorError } = await supabase
        .from("post_collaborators")
        .insert(collaboratorData);

      if (collaboratorError) {
        console.error("Collaborator addition error:", collaboratorError);
        // Don't fail the whole operation if collaborator addition fails
      }
    } else {
      // Add the creator as a collaborator by default
      const { error: collaboratorError } = await supabase
        .from("post_collaborators")
        .insert([{
          post_id: postData.post_id,
          user_id: userId,
        }]);

      if (collaboratorError) {
        console.error("Collaborator addition error:", collaboratorError);
      }
    }

    const { data: createdPost, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("post_id", postData.post_id)
      .single();

    if (fetchError) {
      console.error("Fetch complete post error:", fetchError);
      return res.status(201).json({ 
        success: true, 
        data: postData,
        message: "Post created successfully"
      });
    }

    const [completePost] = await hydrateCollaborativePosts(supabase, [createdPost]);

    res.status(201).json({ 
      success: true, 
      data: completePost,
      message: "Collaborative post created successfully"
    });

  } catch (error) {
    console.error("Create collaborative post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get collaborative posts (posts where user is collaborator or creator)
export const getCollaborativePosts = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    const { data: collaboratorRows, error: collaboratorFetchError } = await supabase
      .from("post_collaborators")
      .select("post_id")
      .eq("user_id", userId);

    if (collaboratorFetchError) {
      console.error("Fetch collaborator post ids error:", collaboratorFetchError);
      return res.status(500).json({ error: "Failed to fetch posts" });
    }

    const collaboratorPostIds = Array.from(
      new Set((collaboratorRows || []).map((row) => row.post_id).filter(Boolean))
    );

    // Get posts where user is creator or collaborator. PostgREST cannot parse
    // OR filters that cross embedded relations, so resolve collaborator ids first.
    let postsQuery = supabase
      .from("posts")
      .select("*")
      .eq("is_collaborative", true);

    if (collaboratorPostIds.length > 0) {
      postsQuery = postsQuery.or(`user_id.eq.${userId},post_id.in.(${collaboratorPostIds.join(",")})`);
    } else {
      postsQuery = postsQuery.eq("user_id", userId);
    }

    const { data: posts, error: fetchError } = await postsQuery.order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Fetch collaborative posts error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch posts" });
    }

    const hydratedPosts = await hydrateCollaborativePosts(supabase, posts || []);

    res.status(200).json({ 
      success: true, 
      data: hydratedPosts
    });

  } catch (error) {
    console.error("Get collaborative posts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add collaborator to existing post
export const addCollaborator = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { postId } = req.params;
    const { userId: collaboratorId } = req.body;

    if (!collaboratorId) {
      return res.status(400).json({ error: "Collaborator user ID is required" });
    }

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    // Check if user is the creator or already a collaborator
    const { data: postCheck, error: checkError } = await supabase
      .from("posts")
      .select(`
        user_id,
        post_collaborators (user_id)
      `)
      .eq("post_id", postId)
      .single();

    if (checkError || !postCheck) {
      return res.status(404).json({ error: "Post not found" });
    }

    const isCreator = postCheck.user_id === userId;
    const isCollaborator = postCheck.post_collaborators.some(c => c.user_id === userId);

    if (!isCreator && !isCollaborator) {
      return res.status(403).json({ error: "Not authorized to add collaborators" });
    }

    // Add the new collaborator
    const { data, error: addError } = await supabase
      .from("post_collaborators")
      .insert([{
        post_id: postId,
        user_id: collaboratorId,
      }])
      .select("user_id")
      .single();

    if (addError) {
      if (addError.code === '23505') {
        return res.status(400).json({ error: "User is already a collaborator" });
      }
      console.error("Add collaborator error:", addError);
      return res.status(500).json({ error: "Failed to add collaborator" });
    }

    const profilesByUserId = await getProfilesByUserId(supabase, [data.user_id]);

    res.status(200).json({ 
      success: true, 
      data: {
        user_id: data.user_id,
        user_profiles: profilesByUserId[data.user_id] || null,
      },
      message: "Collaborator added successfully"
    });

  } catch (error) {
    console.error("Add collaborator error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Remove collaborator from post
export const removeCollaborator = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { postId, userId: collaboratorId } = req.params;

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    // Check if user is the creator or the collaborator themselves
    const { data: postCheck, error: checkError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("post_id", postId)
      .single();

    if (checkError || !postCheck) {
      return res.status(404).json({ error: "Post not found" });
    }

    const isCreator = postCheck.user_id === userId;
    const isSelf = userId === collaboratorId;

    if (!isCreator && !isSelf) {
      return res.status(403).json({ error: "Not authorized to remove this collaborator" });
    }

    // Remove the collaborator
    const { error: removeError } = await supabase
      .from("post_collaborators")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", collaboratorId);

    if (removeError) {
      console.error("Remove collaborator error:", removeError);
      return res.status(500).json({ error: "Failed to remove collaborator" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Collaborator removed successfully"
    });

  } catch (error) {
    console.error("Remove collaborator error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update collaborative post content
export const updateCollaborativePost = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { postId } = req.params;
    const { content, media_url, media_type, visibility } = req.body;

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    // Check if user is a collaborator
    const { data: collaboratorCheck, error: checkError } = await supabase
      .from("post_collaborators")
      .select("user_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (checkError || !collaboratorCheck) {
      return res.status(403).json({ error: "Not authorized to edit this post" });
    }

    // Update the post
    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (media_url !== undefined) updateData.media_url = media_url;
    if (media_type !== undefined) updateData.media_type = media_type;
    if (visibility !== undefined) updateData.visibility = visibility;

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update(updateData)
      .eq("post_id", postId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update post error:", updateError);
      return res.status(500).json({ error: "Failed to update post" });
    }

    const [completePost] = await hydrateCollaborativePosts(supabase, [updatedPost]);

    res.status(200).json({ 
      success: true, 
      data: completePost,
      message: "Post updated successfully"
    });

  } catch (error) {
    console.error("Update collaborative post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete collaborative post
export const deleteCollaborativePost = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { postId } = req.params;

    const supabase = getSupabase(req);
    const { userId, error } = await getUserIdFromToken(supabase, token);
    
    if (error || !userId) {
      return res.status(401).json({ error: error || "Invalid token" });
    }

    // Check if user is the creator
    const { data: postCheck, error: checkError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("post_id", postId)
      .single();

    if (checkError || !postCheck) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (postCheck.user_id !== userId) {
      return res.status(403).json({ error: "Only the creator can delete this post" });
    }

    // Delete the post (this will cascade delete collaborators, likes, comments)
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("post_id", postId);

    if (deleteError) {
      console.error("Delete post error:", deleteError);
      return res.status(500).json({ error: "Failed to delete post" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Post deleted successfully"
    });

  } catch (error) {
    console.error("Delete collaborative post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
