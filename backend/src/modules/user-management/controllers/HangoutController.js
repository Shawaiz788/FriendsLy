const getSupabase = (req) => req.app.get('supabase');

const isMissingTableError = (error) => error?.code === '42P01';

const createAuthenticatedClient = async (token) => {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const tryCreateSignedMediaUrl = async (mediaUrl) => {
  const url = String(mediaUrl || '').trim();
  if (!url) return null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return null;

  const marker = '/storage/v1/object/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const after = url.slice(idx + marker.length);
  const parts = after.split('/');
  if (parts.length < 3) return null;

  const visibilitySegment = parts[0];
  if (visibilitySegment === 'sign') {
    return url;
  }

  const bucket = parts[1];
  const objectPath = parts.slice(2).join('/');
  if (!bucket || !objectPath) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminSupabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

const parseSupabaseStoragePath = (mediaUrl) => {
  const url = String(mediaUrl || '').trim();
  if (!url) return null;

  const marker = '/storage/v1/object/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const after = url.slice(idx + marker.length);
  const parts = after.split('/');
  if (parts.length < 3) return null;

  const bucket = parts[1];
  let objectPath = parts.slice(2).join('/');
  if (!bucket || !objectPath) return null;

  objectPath = objectPath.split('?')[0];
  return { bucket, objectPath };
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

  let mediaType = 'image';
  if (file.mimetype?.startsWith('video/')) {
    mediaType = 'video';
  } else if (file.mimetype?.startsWith('audio/')) {
    mediaType = 'audio';
  }
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

const getBlockSets = async (supabase, userId, otherIds) => {
  if (!otherIds.length) {
    return { blockedOut: new Set(), blockedIn: new Set() };
  }

  const { data: blockedOutRows, error: blockedOutError } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .in('blocked_id', otherIds);

  if (blockedOutError) throw blockedOutError;

  const { data: blockedInRows, error: blockedInError } = await supabase
    .from('blocks')
    .select('blocker_id')
    .eq('blocked_id', userId)
    .in('blocker_id', otherIds);

  if (blockedInError) throw blockedInError;

  return {
    blockedOut: new Set((blockedOutRows || []).map((row) => row.blocked_id)),
    blockedIn: new Set((blockedInRows || []).map((row) => row.blocker_id)),
  };
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

const formatHangoutSchedule = (scheduledTime) => {
  if (!scheduledTime) return { scheduled_date: null, scheduled_time: null };
  const dateObj = new Date(scheduledTime);
  if (Number.isNaN(dateObj.getTime())) return { scheduled_date: null, scheduled_time: null };

  const iso = dateObj.toISOString();
  return {
    scheduled_date: iso.slice(0, 10),
    scheduled_time: iso.slice(11, 19),
  };
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

  async getGroupMembersWithKeys(req, res) {
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

      const { data: groupChat, error: groupChatError } = await supabase
        .from('group_chats')
        .select('group_id, is_temporary, hangout_id')
        .eq('group_id', groupId)
        .single();

      if (groupChatError) throw groupChatError;

      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      const memberIds = (groupMembers || []).map((member) => member.user_id).filter(Boolean);
      const otherMemberIds = memberIds.filter((memberId) => memberId !== userId);

      if (
        groupChat?.is_temporary === false &&
        groupChat?.hangout_id === null &&
        otherMemberIds.length === 1
      ) {
        const { blockedOut, blockedIn } = await getBlockSets(supabase, userId, otherMemberIds);
        if (blockedOut.size || blockedIn.size) {
          return res.status(403).json({ error: 'You cannot message this user' });
        }
      }

      if (!memberIds.length) return res.json({ data: [] });

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, e2ee_public_key')
        .in('user_id', memberIds);

      if (profilesError) throw profilesError;

      return res.json({ data: profiles || [] });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'E2EE tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async getGroupE2eeKey(req, res) {
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

      const { data: wrappedKey, error: wrappedKeyError } = await supabase
        .from('group_e2ee_wrapped_keys')
        .select('group_id, recipient_user_id, wrapper_user_id, nonce, boxed_key')
        .eq('group_id', groupId)
        .eq('recipient_user_id', userId)
        .maybeSingle();

      if (wrappedKeyError) throw wrappedKeyError;
      if (!wrappedKey) return res.json({ data: null });

      const { data: wrapperProfile, error: wrapperProfileError } = await supabase
        .from('user_profiles')
        .select('user_id, e2ee_public_key')
        .eq('user_id', wrappedKey.wrapper_user_id)
        .maybeSingle();

      if (wrapperProfileError) throw wrapperProfileError;

      return res.json({
        data: {
          ...wrappedKey,
          wrapper_public_key: wrapperProfile?.e2ee_public_key || null,
        },
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'E2EE tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  async upsertGroupE2eeKeys(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { groupId } = req.params;
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys array is required' });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const hasAccess = await ensureGroupMembership(supabase, groupId, userId);
      if (!hasAccess) return res.status(403).json({ error: 'You are not a member of this group chat' });

      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      const memberIds = new Set((members || []).map((row) => row.user_id));
      const normalizedKeys = keys
        .filter((key) =>
          key &&
          typeof key.recipient_user_id === 'string' &&
          typeof key.nonce === 'string' &&
          typeof key.boxed_key === 'string',
        )
        .map((key) => ({
          group_id: groupId,
          recipient_user_id: key.recipient_user_id,
          wrapper_user_id: userId,
          nonce: key.nonce,
          boxed_key: key.boxed_key,
        }))
        .filter((key) => memberIds.has(key.recipient_user_id));

      if (!normalizedKeys.length) {
        return res.status(400).json({ error: 'No valid group recipients supplied' });
      }

      const { error: upsertError } = await supabase
        .from('group_e2ee_wrapped_keys')
        .upsert(normalizedKeys, { onConflict: 'group_id,recipient_user_id' });

      if (upsertError) throw upsertError;

      return res.json({ success: true, count: normalizedKeys.length });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'E2EE tables are missing. Apply schema.sql to your database.' });
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
      const { blockedOut, blockedIn } = await getBlockSets(supabase, userId, senderIds);
      const blockedSenderIds = new Set([...blockedOut, ...blockedIn]);
      const visibleMessages = (messages || []).filter((message) => !blockedSenderIds.has(message.sender_id));

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

      const parsedMessages = visibleMessages.map((message) => {
        const payload = parseMessagePayload(message.encrypted_payload);
        return {
          ...message,
          text: payload.kind === 'text' ? payload.text || '' : '',
          payload,
          sender_profile: senderByUserId[message.sender_id] || null,
        };
      });

      const pollMessagePayloads = parsedMessages.filter(
        (message) => message.message_type === 'poll' && message.payload?.kind === 'poll' && message.payload.poll_id,
      );
      const pollIds = Array.from(new Set(pollMessagePayloads.map((message) => message.payload.poll_id)));

      if (pollIds.length) {
        const { data: pollOptions, error: pollOptionsError } = await supabase
          .from('poll_options')
          .select('option_id, option_text, poll_id')
          .in('poll_id', pollIds);

        if (pollOptionsError) throw pollOptionsError;

        const { data: pollVotes, error: pollVotesError } = await supabase
          .from('poll_votes')
          .select('poll_id, option_id, user_id')
          .in('poll_id', pollIds);

        if (pollVotesError) throw pollVotesError;

        const voteCountByOption = {};
        const userVoteByPoll = {};

        for (const vote of pollVotes || []) {
          voteCountByOption[vote.option_id] = (voteCountByOption[vote.option_id] || 0) + 1;
          if (vote.user_id === userId) {
            userVoteByPoll[vote.poll_id] = vote.option_id;
          }
        }

        const optionsByPoll = (pollOptions || []).reduce((acc, option) => {
          acc[option.poll_id] = acc[option.poll_id] || [];
          acc[option.poll_id].push({
            option_id: option.option_id,
            option_text: option.option_text,
            votes: voteCountByOption[option.option_id] || 0,
          });
          return acc;
        }, {});

        const data = parsedMessages.map((message) => {
          if (message.message_type === 'poll' && message.payload?.kind === 'poll' && message.payload.poll_id) {
            return {
              ...message,
              payload: {
                ...message.payload,
                options: optionsByPoll[message.payload.poll_id] || message.payload.options || [],
                user_vote_option_id: userVoteByPoll[message.payload.poll_id] || null,
              },
            };
          }
          return message;
        });

        return res.json({ data });
      }

      return res.json({ data: parsedMessages });
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

      const hasText = String(normalizedPayload.text || '').trim().length > 0;
      const hasE2eePayload =
        normalizedPayload.kind === 'text' &&
        normalizedPayload.e2ee &&
        typeof normalizedPayload.e2ee === 'object' &&
        typeof normalizedPayload.e2ee.nonce === 'string' &&
        typeof normalizedPayload.e2ee.ciphertext === 'string';

      if (normalizedPayload.kind === 'text' && !hasText && !hasE2eePayload) {
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

      if (normalizedMessageType === 'poll') {
        if (normalizedPayload.kind !== 'poll') {
          return res.status(400).json({ error: "Poll messages require payload.kind='poll'" });
        }

        const question = String(normalizedPayload.question || '').trim();
        const rawOptions = Array.isArray(normalizedPayload.options) ? normalizedPayload.options : [];
        const optionTexts = rawOptions
          .map((option) => {
            if (!option) return '';
            if (typeof option === 'string') return String(option).trim();
            return String(option.option_text || option.text || '').trim();
          })
          .filter((optionText) => optionText);

        if (!question) {
          return res.status(400).json({ error: 'Poll question is required' });
        }

        if (optionTexts.length < 2) {
          return res.status(400).json({ error: 'Poll requires at least 2 options' });
        }

        if (optionTexts.length > 8) {
          return res.status(400).json({ error: 'Poll supports up to 8 options' });
        }

        const { data: pollRow, error: pollCreateError } = await supabase
          .from('polls')
          .insert([{ group_id: groupId, question, created_by: userId }])
          .select('poll_id')
          .single();

        if (pollCreateError) throw pollCreateError;

        const pollId = pollRow.poll_id;
        const pollOptionsPayload = optionTexts.map((optionText) => ({ poll_id: pollId, option_text: optionText }));

        const { data: createdOptions, error: pollOptionsError } = await supabase
          .from('poll_options')
          .insert(pollOptionsPayload)
          .select('option_id, option_text');

        if (pollOptionsError) throw pollOptionsError;

        normalizedPayload = {
          kind: 'poll',
          poll_id: pollId,
          question,
          options: (createdOptions || []).map((createdOption) => ({
            option_id: createdOption.option_id,
            option_text: createdOption.option_text,
            votes: 0,
          })),
        };
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

      if (membersError) {
        console.log('⚠️ Unable to load group members for notifications:', membersError);
      } else {
        const recipientIds = (groupMembers || [])
          .map((member) => member.user_id)
          .filter((memberId) => memberId && memberId !== userId);

        if (recipientIds.length) {
          const { data: existingNotifications, error: existingError } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('type', 'message')
            .eq('reference_id', groupId)
            .eq('is_read', false)
            .in('user_id', recipientIds);

          if (existingError) {
            console.log('⚠️ Unable to check message notifications:', existingError);
          }

          const existingRecipients = new Set((existingNotifications || []).map((row) => row.user_id));
          const recipientsToNotify = recipientIds.filter((recipientId) => !existingRecipients.has(recipientId));

          if (recipientsToNotify.length) {
            const notificationRows = recipientsToNotify.map((recipientId) => ({
              user_id: recipientId,
              type: 'message',
              reference_id: groupId,
            }));
            const { error: notificationError } = await supabase.from('notifications').insert(notificationRows);
            if (notificationError) {
              console.log('⚠️ Unable to create message notifications:', notificationError);
            }
          }
        }
      }

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

  async voteInPoll(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { groupId, pollId } = req.params;
    const { option_id } = req.body;

    if (!option_id) {
      return res.status(400).json({ error: 'option_id is required' });
    }

    try {
      const currentUser = await getCurrentUser(baseSupabase, token);
      if (!currentUser?.id) return res.status(401).json({ error: 'Unauthorized' });

      const userId = currentUser.id;
      const supabase = await createAuthenticatedClient(token);

      const hasAccess = await ensureGroupMembership(supabase, groupId, userId);
      if (!hasAccess) return res.status(403).json({ error: 'You are not a member of this group chat' });

      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .select('poll_id, group_id')
        .eq('poll_id', pollId)
        .single();

      if (pollError || !poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      if (poll.group_id !== groupId) {
        return res.status(400).json({ error: 'Poll does not belong to this group' });
      }

      const { data: optionRow, error: optionError } = await supabase
        .from('poll_options')
        .select('option_id')
        .eq('option_id', option_id)
        .eq('poll_id', pollId)
        .single();

      if (optionError || !optionRow) {
        return res.status(400).json({ error: 'Invalid poll option' });
      }

      const { error: voteError } = await supabase.from('poll_votes').upsert(
        [{ poll_id: pollId, option_id, user_id: userId }],
        { onConflict: 'poll_id,user_id' },
      );

      if (voteError) throw voteError;

      const { data: pollVotes, error: pollVotesError } = await supabase
        .from('poll_votes')
        .select('option_id, user_id')
        .eq('poll_id', pollId);

      if (pollVotesError) throw pollVotesError;

      const voteCounts = (pollVotes || []).reduce((acc, vote) => {
        acc[vote.option_id] = (acc[vote.option_id] || 0) + 1;
        return acc;
      }, {});

      return res.json({
        success: true,
        poll_id: pollId,
        selected_option_id: option_id,
        counts: voteCounts,
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Poll tables are missing. Apply schema.sql to your database.' });
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

      const { data: hangout, error: hangoutError } = await supabase
        .from('hangouts')
        .select('hangout_id, title, description, scheduled_time, location, status, created_at, hangout_intents(name)')
        .eq('hangout_id', capsule.hangout_id)
        .single();

      if (hangoutError) throw hangoutError;

      const { data: participants, error: participantsError } = await supabase
        .from('hangout_participants')
        .select('user_id, status')
        .eq('hangout_id', capsule.hangout_id);

      if (participantsError) throw participantsError;

      const participantIds = Array.from(new Set((participants || []).map((row) => row.user_id)));
      let participantProfiles = [];
      if (participantIds.length) {
        const { data, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', participantIds);

        if (profilesError) throw profilesError;
        participantProfiles = data || [];
      }

      const participantProfileById = Object.fromEntries(
        (participantProfiles || []).map((row) => [row.user_id, row]),
      );

      const participantData = (participants || []).map((row) => ({
        user_id: row.user_id,
        status: row.status,
        profile: participantProfileById[row.user_id] || null,
      }));

      const attendees = participantData.filter((row) => row.status === 'accepted');
      const scheduleInfo = formatHangoutSchedule(hangout?.scheduled_time);

      // Fetch media
      const { data: media, error: mediaError } = await supabase
        .from('capsule_media')
        .select('media_id, media_url, media_type, uploaded_by, created_at')
        .eq('capsule_id', capsuleId)
        .order('created_at', { ascending: false });

      if (mediaError) throw mediaError;

      // Get uploader profiles for media
      const uploaderIds = Array.from(new Set((media || []).map((row) => row.uploaded_by)));
      let uploaderProfiles = [];
      if (uploaderIds.length) {
        const { data, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', uploaderIds);

        if (profilesError) throw profilesError;
        uploaderProfiles = data || [];
      }
      const profileByUserId = Object.fromEntries((uploaderProfiles || []).map((row) => [row.user_id, row]));

      const mediaData = (media || []).map((m) => ({
        ...m,
        media_url: m.media_url,
        uploader: profileByUserId[m.uploaded_by] || null,
      }));

      for (const item of mediaData) {
        const signed = await tryCreateSignedMediaUrl(item.media_url);
        if (signed) {
          item.media_url = signed;
        }
      }

      // Fetch reflections
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
      const reflectionProfileByUserId = Object.fromEntries((reflectionProfiles || []).map((row) => [row.user_id, row]));

      const reflectionData = (reflections || []).map((reflection) => ({
        ...reflection,
        author: reflectionProfileByUserId[reflection.user_id] || null,
      }));

      return res.json({
        data: {
          ...capsule,
          hangout: {
            hangout_id: hangout.hangout_id,
            title: hangout.title,
            description: hangout.description,
            status: hangout.status,
            created_at: hangout.created_at,
            hangout_type: hangout?.hangout_intents?.name || 'Hangout',
            scheduled_time: hangout.scheduled_time,
            scheduled_date: scheduleInfo.scheduled_date,
            scheduled_time_of_day: scheduleInfo.scheduled_time,
            location: hangout.location,
            participants: participantData,
            attendees,
          },
          media: mediaData,
          reflections: reflectionData,
        },
      });
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

    if (!['image', 'video', 'audio'].includes(media_type)) {
      return res.status(400).json({ error: "media_type must be 'image', 'video', or 'audio'" });
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

  async deleteCapsuleMedia(req, res) {
    const baseSupabase = getSupabase(req);
    const token = req.supabaseToken;
    const { capsuleId, mediaId } = req.params;

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

      const { data: mediaRow, error: mediaError } = await supabase
        .from('capsule_media')
        .select('media_id, media_url, uploaded_by')
        .eq('capsule_id', capsuleId)
        .eq('media_id', mediaId)
        .single();

      if (mediaError) throw mediaError;
      if (!mediaRow) return res.status(404).json({ error: 'Media not found' });

      if (mediaRow.uploaded_by !== userId) {
        return res.status(403).json({ error: 'Only the uploader can delete this media' });
      }

      const { error: deleteError } = await supabase
        .from('capsule_media')
        .delete()
        .eq('capsule_id', capsuleId)
        .eq('media_id', mediaId);

      if (deleteError) throw deleteError;

      const storagePath = parseSupabaseStoragePath(mediaRow.media_url);
      if (storagePath) {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);
          await adminSupabase.storage.from(storagePath.bucket).remove([storagePath.objectPath]);
        }
      }

      return res.json({ success: true });
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(500).json({ error: 'Capsule tables are missing. Apply schema.sql to your database.' });
      }
      return res.status(500).json({ error: error.message });
    }
  },
};

export default HangoutController;
