const getSupabase = (req) => req.app.get('supabase');

const isMissingTableError = (error) => error?.code === '42P01';

const createAuthenticatedClient = async (token) => {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const resolveIntentId = async (supabase, intentName) => {
  const normalizedIntent = (intentName || 'Hangout').trim();

  const { data: intentRows, error: intentError } = await supabase
    .from('hangout_intents')
    .select('intent_id, name')
    .ilike('name', normalizedIntent)
    .limit(1);

  if (intentError) throw intentError;
  if (intentRows?.length) return intentRows[0].intent_id;

  const { data: insertedRows, error: insertIntentError } = await supabase
    .from('hangout_intents')
    .insert([{ name: normalizedIntent, icon: 'sparkles' }])
    .select('intent_id')
    .limit(1);

  if (insertIntentError) throw insertIntentError;
  return insertedRows[0].intent_id;
};

const ensureGroupForHangout = async (supabase, hangoutId) => {
  const { data: existingGroup, error: groupFetchError } = await supabase
    .from('group_chats')
    .select('group_id')
    .eq('hangout_id', hangoutId)
    .limit(1)
    .maybeSingle();

  if (groupFetchError) throw groupFetchError;
  if (existingGroup?.group_id) return existingGroup.group_id;

  const autoDeleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: newGroup, error: groupInsertError } = await supabase
    .from('group_chats')
    .insert([
      {
        hangout_id: hangoutId,
        is_temporary: true,
        auto_delete_at: autoDeleteAt,
      },
    ])
    .select('group_id')
    .single();

  if (groupInsertError) throw groupInsertError;
  return newGroup.group_id;
};

const ensureCapsuleForHangout = async (supabase, hangoutId) => {
  const { data: existingCapsule, error: capsuleFetchError } = await supabase
    .from('capsules')
    .select('capsule_id')
    .eq('hangout_id', hangoutId)
    .limit(1)
    .maybeSingle();

  if (capsuleFetchError) throw capsuleFetchError;
  if (existingCapsule?.capsule_id) return existingCapsule.capsule_id;

  const { data: createdCapsule, error: capsuleInsertError } = await supabase
    .from('capsules')
    .insert([
      {
        hangout_id: hangoutId,
        summary: 'Auto-generated capsule for temporary hangout group.',
        auto_generated: true,
      },
    ])
    .select('capsule_id')
    .single();

  if (capsuleInsertError) throw capsuleInsertError;
  return createdCapsule.capsule_id;
};

const ensureGroupMember = async (supabase, groupId, userId, role = 'member') => {
  const { error } = await supabase.from('group_members').upsert(
    [{ group_id: groupId, user_id: userId, role }],
    { onConflict: 'group_id,user_id' },
  );

  if (error) throw error;
};

const ensureCapsuleMediaRecord = async (supabase, capsuleId, userId, mediaUrl, mediaType) => {
  const { error } = await supabase.from('capsule_media').insert([
    {
      capsule_id: capsuleId,
      uploaded_by: userId,
      media_url: mediaUrl,
      media_type: mediaType,
    },
  ]);

  if (error) throw error;
};

const uploadToPostMediaBucket = async (file, userId, capsuleId) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in backend env.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

  const bucket = process.env.POST_MEDIA_BUCKET || 'profile-images';
  const safeName = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const objectPath = `capsules/${capsuleId}/${userId}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await adminSupabase.storage
    .from(bucket)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = adminSupabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!publicUrlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  const mediaType = file.mimetype?.startsWith('video/') ? 'video' : 'image';
  return { url: publicUrlData.publicUrl, mediaType };
};

const ensureAcceptedFriendship = async (supabase, userId, friendId) => {
  const { data: friendship, error: friendshipError } = await supabase
    .from('friendships')
    .select('status')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
    )
    .maybeSingle();

  if (friendshipError) throw friendshipError;
  return friendship?.status === 'accepted';
};

const findDirectChatGroupId = async (supabase, userId, friendId) => {
  const { data: userGroups, error: userGroupsError } = await supabase
    .from('group_members')
    .select('group_id, group_chats!inner(is_temporary, hangout_id)')
    .eq('user_id', userId)
    .eq('group_chats.is_temporary', false)
    .is('group_chats.hangout_id', null);

  if (userGroupsError) throw userGroupsError;

  const candidateGroupIds = Array.from(new Set((userGroups || []).map((row) => row.group_id)));
  if (!candidateGroupIds.length) return null;

  const { data: friendMembership, error: friendMembershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', friendId)
    .in('group_id', candidateGroupIds)
    .limit(1)
    .maybeSingle();

  if (friendMembershipError) throw friendMembershipError;
  return friendMembership?.group_id || null;
};

const getOpenSharedHangout = async (supabase, userId, suggestedUserId) => {
  const { data: myRows, error: myRowsError } = await supabase
    .from('hangout_participants')
    .select('hangout_id')
    .eq('user_id', userId);

  if (myRowsError) throw myRowsError;
  const myHangoutIds = (myRows || []).map((row) => row.hangout_id);
  if (!myHangoutIds.length) return null;

  const { data: sharedRows, error: sharedRowsError } = await supabase
    .from('hangout_participants')
    .select('hangout_id')
    .eq('user_id', suggestedUserId)
    .in('hangout_id', myHangoutIds);

  if (sharedRowsError) throw sharedRowsError;
  const sharedIds = (sharedRows || []).map((row) => row.hangout_id);
  if (!sharedIds.length) return null;

  const { data: openHangout, error: openHangoutError } = await supabase
    .from('hangouts')
    .select('hangout_id, status')
    .in('hangout_id', sharedIds)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openHangoutError) throw openHangoutError;
  return openHangout?.hangout_id || null;
};

const updateHangoutStatusByAcceptedCount = async (supabase, hangoutId) => {
  const { data: acceptedRows, error: acceptedRowsError } = await supabase
    .from('hangout_participants')
    .select('user_id')
    .eq('hangout_id', hangoutId)
    .eq('status', 'accepted');

  if (acceptedRowsError) throw acceptedRowsError;

  const nextStatus = acceptedRows.length >= 2 ? 'confirmed' : 'pending';
  const { error: statusUpdateError } = await supabase
    .from('hangouts')
    .update({ status: nextStatus })
    .eq('hangout_id', hangoutId);

  if (statusUpdateError) throw statusUpdateError;
  return nextStatus;
};

const getCurrentUser = async (supabase, token) => {
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) return null;
  return userData.user;
};

const ensureGroupMembership = async (supabase, groupId, userId) => {
  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return false;
  return true;
};

const parseMessagePayload = (rawPayload) => {
  if (!rawPayload) return { kind: 'text', text: '' };

  try {
    const parsed = JSON.parse(rawPayload);
    if (parsed && typeof parsed === 'object' && parsed.kind) return parsed;
  } catch {
    // Legacy plain-text payload support.
  }

  return { kind: 'text', text: String(rawPayload) };
};

const HangoutController = {
  async acceptSuggestedHangout(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { suggested_user_id, intent_name, title, description } = req.body;

    if (!suggested_user_id) {
      return res.status(400).json({ error: 'suggested_user_id is required' });
    }

    try {
      const { data: userData, error: userError } = await baseSupabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const requesterId = userData.user.id;
      if (requesterId === suggested_user_id) {
        return res.status(400).json({ error: 'Cannot create hangout with yourself' });
      }

      const supabase = await createAuthenticatedClient(token);

      const { data: friendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('status')
        .or(
          `and(requester_id.eq.${requesterId},addressee_id.eq.${suggested_user_id}),and(requester_id.eq.${suggested_user_id},addressee_id.eq.${requesterId})`,
        )
        .maybeSingle();

      if (friendshipError) throw friendshipError;
      if (!friendship || friendship.status !== 'accepted') {
        return res.status(400).json({ error: 'Hangouts can only be created with accepted friends' });
      }

      const existingHangoutId = await getOpenSharedHangout(supabase, requesterId, suggested_user_id);
      let hangoutId = existingHangoutId;

      if (!hangoutId) {
        const intentId = await resolveIntentId(supabase, intent_name);
        const { data: newHangout, error: hangoutInsertError } = await supabase
          .from('hangouts')
          .insert([
            {
              creator_id: requesterId,
              intent_id: intentId,
              title: title || `${intent_name || 'Hangout'} with friend`,
              description: description || 'Auto-created from radius overlap suggestion.',
              status: 'pending',
            },
          ])
          .select('hangout_id')
          .single();

        if (hangoutInsertError) throw hangoutInsertError;
        hangoutId = newHangout.hangout_id;

        const { error: participantInsertError } = await supabase.from('hangout_participants').upsert(
          [
            { hangout_id: hangoutId, user_id: requesterId, status: 'accepted' },
            { hangout_id: hangoutId, user_id: suggested_user_id, status: 'invited' },
          ],
          { onConflict: 'hangout_id,user_id' },
        );

        if (participantInsertError) throw participantInsertError;

        const { error: inviteNotificationError } = await supabase.from('notifications').insert([
          {
            user_id: suggested_user_id,
            type: 'hangout_invite',
            reference_id: hangoutId,
          },
        ]);

        if (inviteNotificationError) throw inviteNotificationError;
      } else {
        const { error: participantUpsertError } = await supabase.from('hangout_participants').upsert(
          [{ hangout_id: hangoutId, user_id: requesterId, status: 'accepted' }],
          { onConflict: 'hangout_id,user_id' },
        );

        if (participantUpsertError) throw participantUpsertError;
      }

      const groupId = await ensureGroupForHangout(supabase, hangoutId);
      await ensureGroupMember(supabase, groupId, requesterId, 'owner');
      const capsuleId = await ensureCapsuleForHangout(supabase, hangoutId);
      const status = await updateHangoutStatusByAcceptedCount(supabase, hangoutId);

      return res.json({
        success: true,
        hangout_id: hangoutId,
        group_id: groupId,
        capsule_id: capsuleId,
        status,
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Hangout tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async getMyHangoutInvites(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;

    try {
      const { data: userData, error: userError } = await baseSupabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = userData.user.id;
      const supabase = await createAuthenticatedClient(token);

      const { data: invites, error: invitesError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, status, hangouts!inner(creator_id, title, description, status, created_at)')
        .eq('user_id', userId)
        .eq('status', 'invited')
        .order('created_at', { foreignTable: 'hangouts', ascending: false });

      if (invitesError) throw invitesError;

      const creatorIds = Array.from(
        new Set((invites || []).map((invite) => invite.hangouts?.creator_id).filter(Boolean)),
      );

      let profilesById = {};
      if (creatorIds.length) {
        const { data: creatorProfiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', creatorIds);

        if (profilesError) throw profilesError;
        profilesById = Object.fromEntries((creatorProfiles || []).map((row) => [row.user_id, row]));
      }

      const data = (invites || []).map((invite) => {
        const creatorId = invite.hangouts?.creator_id;
        return {
          hangout_id: invite.hangout_id,
          title: invite.hangouts?.title || 'Hangout Invite',
          description: invite.hangouts?.description || '',
          status: invite.hangouts?.status || 'pending',
          created_at: invite.hangouts?.created_at,
          creator: profilesById[creatorId] || null,
        };
      });

      return res.json({ data });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Hangout tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async respondToHangoutInvite(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { hangoutId } = req.params;
    const { action } = req.body;

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: "action must be either 'accept' or 'decline'" });
    }

    try {
      const { data: userData, error: userError } = await baseSupabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = userData.user.id;
      const supabase = await createAuthenticatedClient(token);

      const nextParticipantStatus = action === 'accept' ? 'accepted' : 'declined';
      const { error: participantError } = await supabase.from('hangout_participants').upsert(
        [{ hangout_id: hangoutId, user_id: userId, status: nextParticipantStatus }],
        { onConflict: 'hangout_id,user_id' },
      );

      if (participantError) throw participantError;

      let groupId = null;
      let capsuleId = null;
      if (action === 'accept') {
        groupId = await ensureGroupForHangout(supabase, hangoutId);
        await ensureGroupMember(supabase, groupId, userId, 'member');
        capsuleId = await ensureCapsuleForHangout(supabase, hangoutId);
      }

      const status = await updateHangoutStatusByAcceptedCount(supabase, hangoutId);

      if (action === 'accept') {
        const { data: hangoutRow, error: hangoutError } = await supabase
          .from('hangouts')
          .select('creator_id')
          .eq('hangout_id', hangoutId)
          .single();

        if (hangoutError) throw hangoutError;

        const { error: joinNotificationError } = await supabase.from('notifications').insert([
          {
            user_id: hangoutRow.creator_id,
            type: 'hangout_joined',
            reference_id: hangoutId,
          },
        ]);

        if (joinNotificationError) throw joinNotificationError;
      }

      return res.json({
        success: true,
        action,
        hangout_id: hangoutId,
        group_id: groupId,
        capsule_id: capsuleId,
        status,
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Hangout tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async getOrCreateDirectChat(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { friend_id } = req.body;

    if (!friend_id) {
      return res.status(400).json({ error: 'friend_id is required' });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      if (userId === friend_id) {
        return res.status(400).json({ error: 'Cannot create a direct chat with yourself' });
      }

      const supabase = await createAuthenticatedClient(token);
      const isFriend = await ensureAcceptedFriendship(supabase, userId, friend_id);

      if (!isFriend) {
        return res.status(403).json({ error: 'Direct chats are only available for accepted friends' });
      }

      let groupId = await findDirectChatGroupId(supabase, userId, friend_id);

      if (!groupId) {
        const { data: newGroup, error: groupInsertError } = await supabase
          .from('group_chats')
          .insert([
            {
              is_temporary: false,
              auto_delete_at: null,
            },
          ])
          .select('group_id')
          .single();

        if (groupInsertError) throw groupInsertError;

        groupId = newGroup.group_id;
        await ensureGroupMember(supabase, groupId, userId, 'owner');
        await ensureGroupMember(supabase, groupId, friend_id, 'member');
      }

      return res.json({ success: true, group_id: groupId });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Chat tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async getMyHangouts(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const { data: myParticipations, error: participationError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, status')
        .eq('user_id', userId)
        .in('status', ['accepted', 'invited']);

      if (participationError) throw participationError;

      const hangoutIds = (myParticipations || []).map((row) => row.hangout_id);
      if (!hangoutIds.length) return res.json({ data: [] });

      const { data: hangouts, error: hangoutError } = await supabase
        .from('hangouts')
        .select('hangout_id, creator_id, title, description, status, created_at')
        .in('hangout_id', hangoutIds)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false });

      if (hangoutError) throw hangoutError;
      if (!hangouts?.length) return res.json({ data: [] });

      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, user_id, status')
        .in('hangout_id', hangoutIds);

      if (allParticipantsError) throw allParticipantsError;

      const participantUserIds = Array.from(new Set((allParticipants || []).map((row) => row.user_id)));
      const { data: participantProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url')
        .in('user_id', participantUserIds);

      if (profilesError) throw profilesError;
      const profileByUserId = Object.fromEntries((participantProfiles || []).map((row) => [row.user_id, row]));

      const { data: groups, error: groupsError } = await supabase
        .from('group_chats')
        .select('group_id, hangout_id, is_temporary, auto_delete_at')
        .in('hangout_id', hangoutIds);

      if (groupsError) throw groupsError;
      const groupByHangoutId = Object.fromEntries((groups || []).map((row) => [row.hangout_id, row]));

      const { data: capsules, error: capsulesError } = await supabase
        .from('capsules')
        .select('capsule_id, hangout_id, summary, created_at')
        .in('hangout_id', hangoutIds);

      if (capsulesError) throw capsulesError;
      const capsuleByHangoutId = Object.fromEntries((capsules || []).map((row) => [row.hangout_id, row]));

      const participationByHangout = Object.fromEntries(
        (myParticipations || []).map((row) => [row.hangout_id, row.status]),
      );

      const data = hangouts.map((hangout) => {
        const participants = (allParticipants || [])
          .filter((row) => row.hangout_id === hangout.hangout_id)
          .map((row) => ({
            user_id: row.user_id,
            status: row.status,
            profile: profileByUserId[row.user_id] || null,
          }));

        return {
          ...hangout,
          my_status: participationByHangout[hangout.hangout_id] || 'invited',
          group_chat: groupByHangoutId[hangout.hangout_id] || null,
          capsule: capsuleByHangoutId[hangout.hangout_id] || null,
          participants,
        };
      });

      return res.json({ data });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Hangout tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async getGroupMessages(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { groupId } = req.params;

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const hasAccess = await ensureGroupMembership(supabase, groupId, userId);
      if (!hasAccess) return res.status(403).json({ error: 'You are not a member of this group chat' });

      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('message_id, sender_id, encrypted_payload, message_type, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (messagesError) throw messagesError;

      const senderIds = Array.from(new Set((messages || []).map((message) => message.sender_id)));
      let senderProfiles = [];
      if (senderIds.length) {
        const { data, error: senderProfilesError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', senderIds);

        if (senderProfilesError) throw senderProfilesError;
        senderProfiles = data || [];
      }
      const senderByUserId = Object.fromEntries((senderProfiles || []).map((row) => [row.user_id, row]));

      const data = (messages || []).map((message) => {
        const payload = parseMessagePayload(message.encrypted_payload);
        return {
          ...message,
          text: payload.kind === 'text' ? payload.text || '' : '',
          payload,
          sender_profile: senderByUserId[message.sender_id] || null,
        };
      });

      return res.json({ data });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Messaging tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async sendGroupMessage(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { groupId } = req.params;
    const { text, message_type, payload } = req.body;

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const hasAccess = await ensureGroupMembership(supabase, groupId, userId);
      if (!hasAccess) return res.status(403).json({ error: 'You are not a member of this group chat' });

      const normalizedMessageType = ['text', 'voice', 'poll'].includes(message_type) ? message_type : 'text';

      let normalizedPayload = null;
      if (payload && typeof payload === 'object') {
        normalizedPayload = payload;
      } else if (text && String(text).trim()) {
        normalizedPayload = { kind: 'text', text: String(text).trim() };
      }

      if (!normalizedPayload) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      if (!normalizedPayload.kind) {
        normalizedPayload.kind = normalizedMessageType === 'voice' ? 'voice' : 'text';
      }

      if (normalizedPayload.kind === 'text' && !String(normalizedPayload.text || '').trim()) {
        return res.status(400).json({ error: 'Text message cannot be empty' });
      }

      if (normalizedPayload.kind === 'voice' && !String(normalizedPayload.url || '').trim()) {
        return res.status(400).json({ error: 'Voice message URL is required' });
      }

      if (normalizedPayload.kind === 'image' && !String(normalizedPayload.url || '').trim()) {
        return res.status(400).json({ error: 'Image message URL is required' });
      }

      if (
        normalizedPayload.kind === 'location' &&
        (typeof normalizedPayload.latitude !== 'number' || typeof normalizedPayload.longitude !== 'number')
      ) {
        return res.status(400).json({ error: 'Location message requires latitude and longitude' });
      }

      const payloadString = JSON.stringify(normalizedPayload);

      const { data: createdMessage, error: createMessageError } = await supabase
        .from('messages')
        .insert([
          {
            group_id: groupId,
            sender_id: userId,
            encrypted_payload: payloadString,
            message_type: normalizedMessageType,
          },
        ])
        .select('message_id, sender_id, encrypted_payload, message_type, created_at')
        .single();

      if (createMessageError) throw createMessageError;

      const createdPayload = parseMessagePayload(createdMessage.encrypted_payload);
      return res.json({
        success: true,
        data: {
          ...createdMessage,
          text: createdPayload.kind === 'text' ? createdPayload.text || '' : '',
          payload: createdPayload,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Messaging tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async uploadGroupMedia(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);
      const hasAccess = await ensureGroupMembership(supabase, groupId, userId);
      if (!hasAccess) return res.status(403).json({ error: 'You are not a member of this group chat' });

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        return res.status(500).json({
          error: 'Missing SUPABASE_SERVICE_ROLE_KEY in backend env.',
        });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

      const configuredBucket = process.env.CHAT_MEDIA_BUCKET || 'profile-images';
      const safeName = String(req.file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const objectPath = `chat-media/${groupId}/${userId}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await adminSupabase.storage
        .from(configuredBucket)
        .upload(objectPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        return res.status(400).json({ error: uploadError.message });
      }

      const { data: publicUrlData } = adminSupabase.storage
        .from(configuredBucket)
        .getPublicUrl(objectPath);

      let capsuleMediaUrl = null;
      let capsuleMediaType = null;

      const { data: groupChat, error: groupChatError } = await supabase
        .from('group_chats')
        .select('hangout_id, is_temporary')
        .eq('group_id', groupId)
        .maybeSingle();

      if (groupChatError) throw groupChatError;

      if (groupChat?.is_temporary && groupChat.hangout_id) {
        const capsuleId = await ensureCapsuleForHangout(supabase, groupChat.hangout_id);
        const uploadResult = await uploadToPostMediaBucket(req.file, userId, capsuleId);
        capsuleMediaUrl = uploadResult.url;
        capsuleMediaType = uploadResult.mediaType;
        await ensureCapsuleMediaRecord(supabase, capsuleId, userId, capsuleMediaUrl, capsuleMediaType);
      }

      return res.json({
        success: true,
        url: publicUrlData?.publicUrl,
        path: objectPath,
        bucket: configuredBucket,
        contentType: req.file.mimetype,
        capsule_media_url: capsuleMediaUrl,
        capsule_media_type: capsuleMediaType,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async getCapsuleDetails(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { capsuleId } = req.params;

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const { data: capsule, error: capsuleError } = await supabase
        .from('capsules')
        .select('capsule_id, hangout_id, summary, auto_generated, created_at')
        .eq('capsule_id', capsuleId)
        .single();

      if (capsuleError) throw capsuleError;

      const { data: membership, error: membershipError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, status')
        .eq('hangout_id', capsule.hangout_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({ error: 'You are not part of this hangout capsule' });

      const { data: reflections, error: reflectionsError } = await supabase
        .from('capsule_reflections')
        .select('reflection_id, user_id, reflection_text, created_at')
        .eq('capsule_id', capsuleId)
        .order('created_at', { ascending: false });

      if (reflectionsError) throw reflectionsError;

      const reflectionUserIds = Array.from(new Set((reflections || []).map((row) => row.user_id)));
      let reflectionProfiles = [];
      if (reflectionUserIds.length) {
        const { data, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', reflectionUserIds);

        if (profilesError) throw profilesError;
        reflectionProfiles = data || [];
      }
      const profileByUserId = Object.fromEntries((reflectionProfiles || []).map((row) => [row.user_id, row]));

      const reflectionData = (reflections || []).map((reflection) => ({
        ...reflection,
        author: profileByUserId[reflection.user_id] || null,
      }));

      return res.json({ data: { ...capsule, reflections: reflectionData } });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Capsule tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async addCapsuleReflection(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { capsuleId } = req.params;
    const { reflection_text } = req.body;

    if (!reflection_text || !String(reflection_text).trim()) {
      return res.status(400).json({ error: 'reflection_text is required' });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const { data: capsule, error: capsuleError } = await supabase
        .from('capsules')
        .select('capsule_id, hangout_id')
        .eq('capsule_id', capsuleId)
        .single();

      if (capsuleError) throw capsuleError;

      const { data: membership, error: membershipError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, status')
        .eq('hangout_id', capsule.hangout_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({ error: 'You are not part of this hangout capsule' });

      const { data: createdReflection, error: createReflectionError } = await supabase
        .from('capsule_reflections')
        .insert([
          {
            capsule_id: capsuleId,
            user_id: userId,
            reflection_text: String(reflection_text).trim(),
          },
        ])
        .select('reflection_id, user_id, reflection_text, created_at')
        .single();

      if (createReflectionError) throw createReflectionError;
      return res.json({ success: true, data: createdReflection });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Capsule tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async addCapsuleMedia(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { capsuleId } = req.params;
    const { media_url, media_type } = req.body;

    if (!media_url || !String(media_url).trim()) {
      return res.status(400).json({ error: 'media_url is required' });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({ error: "media_type must be 'image' or 'video'" });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const { data: capsule, error: capsuleError } = await supabase
        .from('capsules')
        .select('capsule_id, hangout_id')
        .eq('capsule_id', capsuleId)
        .single();

      if (capsuleError) throw capsuleError;

      const { data: membership, error: membershipError } = await supabase
        .from('hangout_participants')
        .select('hangout_id, status')
        .eq('hangout_id', capsule.hangout_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({ error: 'You are not part of this hangout capsule' });

      const { data: createdMedia, error: createMediaError } = await supabase
        .from('capsule_media')
        .insert([
          {
            capsule_id: capsuleId,
            uploaded_by: userId,
            media_url: String(media_url).trim(),
            media_type,
          },
        ])
        .select('media_id, capsule_id, uploaded_by, media_url, media_type, created_at')
        .single();

      if (createMediaError) throw createMediaError;

      return res.json({ success: true, data: createdMedia });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Capsule tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },
};

export default HangoutController;
