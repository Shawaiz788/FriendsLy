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

    // Fetch the complete post with collaborator info
    const { data: completePost, error: fetchError } = await supabase
      .from("posts")
      .select(`
        *,
        post_collaborators (
          user_id,
          user_profiles (
            full_name,
            username,
            profile_photo_url
          )
        ),
        user_profiles!posts_user_id_fkey (
          full_name,
          username,
          profile_photo_url
        )
      `)
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

    // Get posts where user is creator or collaborator
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select(`
        *,
        post_collaborators!inner (
          user_id,
          user_profiles (
            full_name,
            username,
            profile_photo_url
          )
        ),
        user_profiles!posts_user_id_fkey (
          full_name,
          username,
          profile_photo_url
        ),
        post_likes (
          user_id
        ),
        post_comments (
          comment_id,
          content,
          user_id,
          created_at,
          user_profiles (
            full_name,
            username,
            profile_photo_url
          )
        )
      `)
      .eq("is_collaborative", true)
      .or(`user_id.eq.${userId},post_collaborators.user_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Fetch collaborative posts error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch posts" });
    }

    res.status(200).json({ 
      success: true, 
      data: posts || []
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
      .select(`
        user_id,
        user_profiles (
          full_name,
          username,
          profile_photo_url
        )
      `)
      .single();

    if (addError) {
      if (addError.code === '23505') {
        return res.status(400).json({ error: "User is already a collaborator" });
      }
      console.error("Add collaborator error:", addError);
      return res.status(500).json({ error: "Failed to add collaborator" });
    }

    res.status(200).json({ 
      success: true, 
      data,
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
      .select(`
        *,
        post_collaborators (
          user_id,
          user_profiles (
            full_name,
            username,
            profile_photo_url
          )
        ),
        user_profiles!posts_user_id_fkey (
          full_name,
          username,
          profile_photo_url
        )
      `)
      .single();

    if (updateError) {
      console.error("Update post error:", updateError);
      return res.status(500).json({ error: "Failed to update post" });
    }

    res.status(200).json({ 
      success: true, 
      data: updatedPost,
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
