// User controller for registration, profile, authentication

// UserController using ES module export
const getSupabase = (req) => req.app.get('supabase');

const createAuthenticatedClient = async (token) => {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const formatSupabaseError = (error, fallbackMessage) => {
  if (!error) return fallbackMessage;

  switch (error.code) {
    case '42P01':
      return 'Required table is missing. Apply the latest schema.sql to Supabase.';
    case '42703':
      return 'Required column is missing. Apply the latest schema.sql to Supabase.';
    case '42501':
      return 'Operation blocked by RLS. Add/update policies or use the service role key.';
    default:
      return error.message || fallbackMessage;
  }
};

const adminSignOutUser = async (adminSupabase, userId) => {
  if (!adminSupabase || !userId) return null;

  let lastError = null;
  const attempts = [
    () => adminSupabase.auth.admin.signOut(userId, { scope: 'global' }),
    () => adminSupabase.auth.admin.signOut(userId, 'global'),
    () => adminSupabase.auth.admin.signOut(userId),
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (!result?.error) return null;

      lastError = result.error;
      const message = String(result.error.message || '');
      if (!message.toLowerCase().includes('scope')) {
        return lastError;
      }
    } catch (err) {
      lastError = err;
    }
  }

  return lastError;
};

const UserController = {
    async checkUsernameAvailability(req, res) {
      const supabase = getSupabase(req);
      const rawUsername = req.query.username;
      const normalized = typeof rawUsername === 'string' ? rawUsername.trim() : '';
      if (!normalized) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('username')
        .ilike('username', normalized)
        .limit(1);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ available: !data || data.length === 0 });
    },
  async uploadImage(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user id from token (still validate caller)
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.log('Auth error:', userError);
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = userData.user.id;

    try {
      // IMPORTANT: Supabase Storage has its own RLS policies. Even with a user JWT,
      // uploads can fail unless Storage policies are configured.
      // On the backend, use the Service Role key to bypass Storage RLS.
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        return res.status(500).json({
          error:
            'Missing SUPABASE_SERVICE_ROLE_KEY in backend env. Add it to backend/.env and restart the backend.',
        });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

      const fileName = `${userId}-${Date.now()}-${req.file.originalname}`;
      console.log('⬆️ Uploading image (admin):', fileName);

      const { data, error } = await adminSupabase.storage
        .from('profile-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.log('❌ Storage upload error:', error);

        const msg = String(error.message || '');
        if (msg.toLowerCase().includes('invalid compact jws')) {
          return res.status(500).json({
            error:
              'Storage auth failed (Invalid Compact JWS). Update SUPABASE_SERVICE_ROLE_KEY in backend/.env to the current project API service_role key (it changes when JWT is rotated).',
          });
        }

        return res.status(400).json({ error: msg });
      }

      console.log('✅ File uploaded to storage:', data);

      const { data: publicUrlData } = adminSupabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData?.publicUrl;
      console.log('🔗 Generated public URL:', publicUrl);
      if (!publicUrl) {
        return res.status(400).json({ error: 'Failed to get public URL' });
      }

      res.json({ url: publicUrl });
    } catch (err) {
      console.log('💥 Upload exception:', err);
      res.status(500).json({ error: err.message });
    }
  },

  async getMe(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
    res.json({ user: { id: data.user.id, email: data.user.email, phone: data.user.phone } });
  },
  async getMyIntentPreferences(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data, error } = await authenticatedSupabase
        .from('user_intent_preferences')
        .select('active_intent, active_intents, enabled_intents, inner_radius_km, outer_radius_km, auto_expire')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          return res.status(500).json({
            error: 'user_intent_preferences table is missing. Apply schema changes first.',
          });
        }
        return res.status(400).json({ error: error.message });
      }

      // If no preferences exist, create default ones
      if (!data) {
        console.log('No intent preferences found for user, creating defaults:', userId);
        const defaultPrefs = {
          active_intent: 'Free',
          active_intents: ['Free'],
          enabled_intents: ['Free', 'Busy', 'Studying', 'Hungry', 'Working', 'Exercising', 'Just Chilling'],
          inner_radius_km: 1,
          outer_radius_km: 5,
          auto_expire: true
        };

        const { data: createdData, error: createError } = await authenticatedSupabase
          .from('user_intent_preferences')
          .insert([{ user_id: userId, ...defaultPrefs }])
          .select('active_intent, active_intents, enabled_intents, inner_radius_km, outer_radius_km, auto_expire')
          .single();

        if (createError) {
          // Log the error but don't fail - return defaults
          console.log('Warning: Could not create default intent preferences:', createError.message);
          return res.json({
            data: {
              active_intents: defaultPrefs.active_intents,
              enabled_intents: defaultPrefs.enabled_intents,
              inner_radius_km: defaultPrefs.inner_radius_km,
              outer_radius_km: defaultPrefs.outer_radius_km,
              auto_expire: defaultPrefs.auto_expire,
            },
          });
        }

        const normalized = createdData || defaultPrefs;
        return res.json({
          data: {
            active_intents:
              Array.isArray(normalized.active_intents) && normalized.active_intents.length
                ? normalized.active_intents
                : [normalized.active_intent || 'Free'],
            enabled_intents: normalized.enabled_intents,
            inner_radius_km: normalized.inner_radius_km,
            outer_radius_km: normalized.outer_radius_km,
            auto_expire: normalized.auto_expire,
          },
        });
      }

      return res.json({
        data: {
          active_intents:
            Array.isArray(data.active_intents) && data.active_intents.length
              ? data.active_intents
              : [data.active_intent || 'Free'],
          enabled_intents: data.enabled_intents,
          inner_radius_km: data.inner_radius_km,
          outer_radius_km: data.outer_radius_km,
          auto_expire: data.auto_expire,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async upsertMyIntentPreferences(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { active_intents, enabled_intents, inner_radius_km, outer_radius_km, auto_expire } = req.body;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = userData.user.id;

    if (!Array.isArray(active_intents) || active_intents.length === 0) {
      return res.status(400).json({ error: 'active_intents must be a non-empty array of strings' });
    }
    if (!active_intents.every(i => typeof i === 'string' && i.trim())) {
      return res.status(400).json({ error: 'active_intents must contain valid strings' });
    }
    if (!Array.isArray(enabled_intents) || enabled_intents.some((value) => typeof value !== 'string')) {
      return res.status(400).json({ error: 'enabled_intents must be an array of strings' });
    }
    if (!Number.isFinite(inner_radius_km) || !Number.isFinite(outer_radius_km)) {
      return res.status(400).json({ error: 'inner_radius_km and outer_radius_km must be numbers' });
    }
    if (inner_radius_km < 0 || outer_radius_km < 0 || inner_radius_km > outer_radius_km) {
      return res.status(400).json({ error: 'radius values are invalid' });
    }
    if (typeof auto_expire !== 'boolean') {
      return res.status(400).json({ error: 'auto_expire must be a boolean' });
    }

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error } = await authenticatedSupabase
        .from('user_intent_preferences')
        .upsert(
          {
            user_id: userId,
            active_intent: active_intents[0],
            active_intents,
            enabled_intents,
            inner_radius_km,
            outer_radius_km,
            auto_expire,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        if (error.code === '42P01') {
          return res.status(500).json({
            error: 'user_intent_preferences table is missing. Apply schema changes first.',
          });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async register(req, res) {
    const supabase = getSupabase(req);
    console.log('========== REGISTRATION REQUEST ==========');
    console.log('Full payload:', JSON.stringify(req.body, null, 2));
    const { email, phone, password, name, username, photo, interests, date_of_birth, gender } = req.body;
    console.log('Extracted fields:');
    console.log('  email:', email);
    console.log('  phone:', phone);
    console.log('  password:', password ? '***' : 'MISSING');
    console.log('  name:', name);
    console.log('  username:', username);
    console.log('  photo:', photo);
    console.log('  interests:', interests);
    console.log('  date_of_birth:', date_of_birth);
    console.log('  gender:', gender);
    // Validate required fields
    if (!email || !password || !name || !username) {
      console.log('VALIDATION FAILED - Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: email, password, name, username' });
    }
    console.log('VALIDATION PASSED');
    // 1. Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      phone
    });
    if (authError) return res.status(400).json({ error: authError.message });

    // 2. Insert into users table
    const { data: userRow, error: userError } = await supabase.from('users').insert([
      {
        user_id: authData.user.id,
        email,
        phone,
        password_hash: password // In production, hash this!
      }
    ]).select();
    if (userError) return res.status(400).json({ error: userError.message });

    // 3. Insert into user_profiles table
    console.log('Inserting into user_profiles with data:');
    console.log({
      user_id: authData.user.id,
      full_name: name,
      username: username,
      profile_photo_url: photo,
      bio: interests,
      date_of_birth: date_of_birth,
      gender: gender
    });
    const { error: profileError } = await supabase.from('user_profiles').insert([
      {
        user_id: authData.user.id,
        full_name: name,
        username,
        profile_photo_url: photo,
        bio: interests,
        date_of_birth,
        gender
      }
    ]);
    if (profileError) {
      console.log('Profile insertion error:', profileError);
      return res.status(400).json({ error: profileError.message });
    }
    console.log('Profile inserted successfully');

    // 4. Create default intent preferences for the user
    const { error: preferencesError } = await supabase.from('user_intent_preferences').insert([
      {
        user_id: authData.user.id,
        active_intent: 'Free',
        active_intents: ['Free'],
        enabled_intents: ['Free', 'Busy', 'Studying', 'Hungry', 'Working', 'Exercising', 'Just Chilling'],
        inner_radius_km: 1,
        outer_radius_km: 5,
        auto_expire: true
      }
    ]);
    if (preferencesError) {
      console.log('Intent preferences insertion error:', preferencesError);
      return res.status(400).json({ error: preferencesError.message });
    }
    console.log('Intent preferences created successfully');

    res.status(201).json({ user: authData.user });
  },
  async editProfile(req, res) {
    const supabase = getSupabase(req);
    const { name, username, photo, interests, date_of_birth, gender, dark_mode_enabled, selected_theme } = req.body;
    const token = req.supabaseToken;
    
    // Get user id from token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid token' });
    const userId = userData.user.id;
    
    // Create an authenticated client with the user's token for RLS
    const authenticatedSupabase = await createAuthenticatedClient(token);
    
    // Check if profile exists
    const { data: profileRows, error: selectError } = await authenticatedSupabase.from('user_profiles').select('profile_id').eq('user_id', userId);
    if (selectError) return res.status(400).json({ error: selectError.message });
    if (profileRows && profileRows.length > 0) {
      // Update existing profile
      const { error } = await authenticatedSupabase.from('user_profiles').update({
        full_name: name,
        username: username,
        profile_photo_url: photo,
        bio: interests,
        date_of_birth: date_of_birth,
        gender: gender,
        dark_mode_enabled: typeof dark_mode_enabled === 'boolean' ? dark_mode_enabled : false,
        selected_theme: typeof selected_theme === 'string' && selected_theme.trim() ? selected_theme : 'sage-coral',
      }).eq('user_id', userId);
      if (error) {
        console.log('Profile update error:', error);
        return res.status(400).json({ error: error.message });
      }
      res.json({ success: true, action: 'updated' });
    } else {
      // Insert user row if missing
      const { data: userRows, error: userSelectError } = await authenticatedSupabase.from('users').select('user_id').eq('user_id', userId);
      if (userSelectError) return res.status(400).json({ error: userSelectError.message });
      if (!userRows || userRows.length === 0) {
        // Insert user with minimal info (email, phone unknown, password_hash required)
        await authenticatedSupabase.from('users').insert([
          {
            user_id: userId,
            email: null,
            phone: null,
            password_hash: 'placeholder' // required by schema
          }
        ]);
      }
      // Insert new profile with all fields
      const { error } = await authenticatedSupabase.from('user_profiles').insert([
        {
          user_id: userId,
          full_name: name,
          username: username,
          profile_photo_url: photo,
          bio: interests,
          date_of_birth: date_of_birth,
          gender: gender,
          dark_mode_enabled: typeof dark_mode_enabled === 'boolean' ? dark_mode_enabled : false,
          selected_theme: typeof selected_theme === 'string' && selected_theme.trim() ? selected_theme : 'sage-coral',
        }
      ]);
      if (error) {
        console.log('Profile insert error:', error);
        return res.status(400).json({ error: error.message });
      }
      res.json({ success: true, action: 'inserted' });
    }
  },
  async getMyE2eePublicKey(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data, error } = await authenticatedSupabase
        .from('user_profiles')
        .select('e2ee_public_key')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return res.status(400).json({ error: formatSupabaseError(error, 'Unable to load key') });

      return res.json({ data: { e2ee_public_key: data?.e2ee_public_key || null } });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Unable to load key' });
    }
  },
  async setMyE2eePublicKey(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { public_key } = req.body;

    if (!public_key || typeof public_key !== 'string') {
      return res.status(400).json({ error: 'public_key is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error } = await authenticatedSupabase
        .from('user_profiles')
        .update({ e2ee_public_key: public_key })
        .eq('user_id', userId);

      if (error) return res.status(400).json({ error: formatSupabaseError(error, 'Unable to save key') });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Unable to save key' });
    }
  },
  async deactivateAccount(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const adminSupabase = serviceRoleKey
        ? (await import('@supabase/supabase-js')).createClient(process.env.SUPABASE_URL, serviceRoleKey)
        : null;
      const client = adminSupabase || authenticatedSupabase;

      const { error: updateError } = await client
        .from('users')
        .update({ account_status: 'deactivated', updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (updateError) {
        return res.status(400).json({ error: formatSupabaseError(updateError, 'Deactivation failed') });
      }

      if (adminSupabase) {
        const signOutError = await adminSignOutUser(adminSupabase, userId);
        if (signOutError) {
          console.log('Sign out error during deactivation:', signOutError);
        }
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Deactivation failed' });
    }
  },
  async deleteAccount(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(500).json({
        error: 'Missing SUPABASE_SERVICE_ROLE_KEY in backend env. Add it to backend/.env and restart the backend.',
      });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

      const signOutError = await adminSignOutUser(adminSupabase, userId);
      if (signOutError) {
        console.log('Sign out error during deletion:', signOutError);
      }

      const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        return res.status(400).json({ error: formatSupabaseError(deleteAuthError, 'Delete failed') });
      }

      const { error: deleteUserError } = await adminSupabase
        .from('users')
        .delete()
        .eq('user_id', userId);
      if (deleteUserError) {
        return res.status(400).json({ error: formatSupabaseError(deleteUserError, 'Delete failed') });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Delete failed' });
    }
  },
  async downloadData(req, res) {
    const supabase = getSupabase(req);
    const { id, include } = req.query;
    const token = req.supabaseToken;
    
    // Verify the token and user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid token' });

    const userId = userData.user.id;

    // Backward compatible behavior: if no include= is provided, return only user_profiles
    // (existing callers rely on { data: [...] }).
    if (!include) {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const targetUserId = typeof id === 'string' && id ? id : userId;
      if (targetUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Query by user_id, not profile_id
      const { data, error } = await authenticatedSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', targetUserId);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ data });
    }
    
    const requested = String(include)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const includes = requested.length > 0 ? Array.from(new Set(requested)) : ['profile'];

    const authenticatedSupabase = await createAuthenticatedClient(token);

    const safeSelect = async (table, queryFn) => {
      try {
        const result = await queryFn();
        if (result?.error?.code === '42P01') {
          return { data: [], missingTable: table };
        }
        if (result?.error) {
          return { data: [], error: result.error.message, table };
        }
        return { data: result?.data ?? [] };
      } catch (err) {
        return { data: [], error: err.message, table };
      }
    };

    const exportData = {
      generated_at: new Date().toISOString(),
      user_id: userId,
      includes,
      data: {},
      warnings: [],
    };

    if (includes.includes('profile')) {
      const account = await safeSelect('users', () =>
        authenticatedSupabase.from('users').select('*').eq('user_id', userId).maybeSingle(),
      );
      const profile = await safeSelect('user_profiles', () =>
        authenticatedSupabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      );

      if (account.missingTable) exportData.warnings.push(`Missing table: ${account.missingTable}`);
      if (profile.missingTable) exportData.warnings.push(`Missing table: ${profile.missingTable}`);
      if (account.error) exportData.warnings.push(`users: ${account.error}`);
      if (profile.error) exportData.warnings.push(`user_profiles: ${profile.error}`);

      exportData.data.profile = {
        account: account.data || null,
        profile: profile.data || null,
      };
    }

    if (includes.includes('intent')) {
      const intentPrefs = await safeSelect('user_intent_preferences', () =>
        authenticatedSupabase.from('user_intent_preferences').select('*').eq('user_id', userId).maybeSingle(),
      );
      if (intentPrefs.missingTable) exportData.warnings.push(`Missing table: ${intentPrefs.missingTable}`);
      if (intentPrefs.error) exportData.warnings.push(`user_intent_preferences: ${intentPrefs.error}`);
      exportData.data.intent = intentPrefs.data || null;
    }

    if (includes.includes('location')) {
      const location = await safeSelect('user_locations', () =>
        authenticatedSupabase.from('user_locations').select('*').eq('user_id', userId).maybeSingle(),
      );
      if (location.missingTable) exportData.warnings.push(`Missing table: ${location.missingTable}`);
      if (location.error) exportData.warnings.push(`user_locations: ${location.error}`);
      exportData.data.location = location.data || null;
    }

    if (includes.includes('friends')) {
      const friendships = await safeSelect('friendships', () =>
        authenticatedSupabase
          .from('friendships')
          .select('*')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .order('created_at', { ascending: false }),
      );
      if (friendships.missingTable) exportData.warnings.push(`Missing table: ${friendships.missingTable}`);
      if (friendships.error) exportData.warnings.push(`friendships: ${friendships.error}`);
      exportData.data.friends = friendships.data;
    }

    if (includes.includes('hangouts')) {
      const participants = await safeSelect('hangout_participants', () =>
        authenticatedSupabase.from('hangout_participants').select('*').eq('user_id', userId),
      );
      if (participants.missingTable) exportData.warnings.push(`Missing table: ${participants.missingTable}`);
      if (participants.error) exportData.warnings.push(`hangout_participants: ${participants.error}`);

      const hangoutIds = Array.from(new Set((participants.data || []).map((p) => p.hangout_id)));
      const hangouts = hangoutIds.length
        ? await safeSelect('hangouts', () =>
            authenticatedSupabase.from('hangouts').select('*').in('hangout_id', hangoutIds),
          )
        : { data: [] };

      if (hangouts.missingTable) exportData.warnings.push(`Missing table: ${hangouts.missingTable}`);
      if (hangouts.error) exportData.warnings.push(`hangouts: ${hangouts.error}`);

      exportData.data.hangouts = {
        participants: participants.data,
        hangouts: hangouts.data,
      };
    }

    if (includes.includes('chats')) {
      const memberships = await safeSelect('group_members', () =>
        authenticatedSupabase.from('group_members').select('*').eq('user_id', userId),
      );
      if (memberships.missingTable) exportData.warnings.push(`Missing table: ${memberships.missingTable}`);
      if (memberships.error) exportData.warnings.push(`group_members: ${memberships.error}`);

      const groupIds = Array.from(new Set((memberships.data || []).map((m) => m.group_id)));
      const groups = groupIds.length
        ? await safeSelect('group_chats', () => authenticatedSupabase.from('group_chats').select('*').in('group_id', groupIds))
        : { data: [] };
      const messages = groupIds.length
        ? await safeSelect('messages', () =>
            authenticatedSupabase.from('messages').select('*').in('group_id', groupIds).order('created_at', { ascending: true }).limit(5000),
          )
        : { data: [] };

      if (groups.missingTable) exportData.warnings.push(`Missing table: ${groups.missingTable}`);
      if (groups.error) exportData.warnings.push(`group_chats: ${groups.error}`);
      if (messages.missingTable) exportData.warnings.push(`Missing table: ${messages.missingTable}`);
      if (messages.error) exportData.warnings.push(`messages: ${messages.error}`);

      exportData.data.chats = {
        memberships: memberships.data,
        groups: groups.data,
        messages: messages.data,
      };
    }

    if (includes.includes('posts')) {
      const posts = await safeSelect('posts', () =>
        authenticatedSupabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      );
      const postLikes = await safeSelect('post_likes', () => authenticatedSupabase.from('post_likes').select('*').eq('user_id', userId));
      const postComments = await safeSelect('post_comments', () =>
        authenticatedSupabase.from('post_comments').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      );

      for (const r of [posts, postLikes, postComments]) {
        if (r.missingTable) exportData.warnings.push(`Missing table: ${r.missingTable}`);
        if (r.error) exportData.warnings.push(`${r.table}: ${r.error}`);
      }

      exportData.data.posts = {
        posts: posts.data,
        likes: postLikes.data,
        comments: postComments.data,
      };
    }

    return res.json({ success: true, export: exportData });
  },
  async verify(req, res) {
    res.json({ message: 'Verification handled by Supabase.' });
  },
  async logout(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error } = await authenticatedSupabase.auth.signOut();
      if (error) {
        return res.json({ success: true, warning: error.message });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async logoutAll(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(500).json({
        error: 'Missing SUPABASE_SERVICE_ROLE_KEY in backend env. Add it to backend/.env and restart the backend.',
      });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSupabase = createClient(process.env.SUPABASE_URL, serviceRoleKey);

      const { error } = await adminSupabase.auth.admin.signOut(userData.user.id, { scope: 'global' });
      if (error) return res.status(400).json({ error: error.message });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async sessionTimeout(req, res) {
    res.json({ message: 'Session timeout handled by Supabase.' });
  },
  async searchUsers(req, res) {
    const supabase = getSupabase(req);
    const { q } = req.query;
    const token = req.supabaseToken;

    // Verify user is authenticated
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    if (!q || q.trim().length < 2) {
      return res.json({ data: [] });
    }

    try {
      const searchTerm = `%${q.trim()}%`;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url, bio')
        .or(`full_name.ilike.${searchTerm},username.ilike.${searchTerm}`)
        .limit(20);

      if (error) return res.status(400).json({ error: error.message });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async getUserProfile(req, res) {
    const supabase = getSupabase(req);
    const { userId } = req.params;
    const token = req.supabaseToken;

    // Verify user is authenticated (but allow viewing any public profile)
    if (token) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return res.status(404).json({ error: 'User not found' });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async sendFriendRequest(req, res) {
    const supabase = getSupabase(req);
    const { addressee_id } = req.body;
    const token = req.supabaseToken;

    console.log('📨 Attempt to send friend request from token to user:', addressee_id);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const requester_id = userData.user.id;
    console.log('📨 Requester ID:', requester_id);

    if (requester_id === addressee_id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    try {
      // Create authenticated client for RLS
      const authenticatedSupabase = await createAuthenticatedClient(token);

      // Check if request already exists in either direction
      // Case 1: Request from me to them
      const { data: outgoing } = await authenticatedSupabase
        .from('friendships')
        .select('status')
        .eq('requester_id', requester_id)
        .eq('addressee_id', addressee_id)
        .maybeSingle();

      if (outgoing) {
        console.log('Found outgoing friendship with status:', outgoing.status);
        if (outgoing.status === 'accepted') {
          return res.status(400).json({ error: 'You are already friends' });
        } else if (outgoing.status === 'pending') {
          return res.status(400).json({ error: 'Friend request already pending' });
        }
      }

      // Case 2: Request from them to me
      const { data: incoming } = await authenticatedSupabase
        .from('friendships')
        .select('status')
        .eq('requester_id', addressee_id)
        .eq('addressee_id', requester_id)
        .maybeSingle();

      if (incoming) {
        console.log('Found incoming friendship with status:', incoming.status);
        if (incoming.status === 'accepted') {
          return res.status(400).json({ error: 'You are already friends' });
        } else if (incoming.status === 'pending') {
          return res.status(400).json({ error: 'This user has already sent you a friend request' });
        }
      }

      console.log('✅ All checks passed, inserting new friendship...');
      // Insert new friend request
      const { data: insertResult, error: insertError } = await authenticatedSupabase
        .from('friendships')
        .insert([
          {
            requester_id,
            addressee_id,
            status: 'pending',
          },
        ])
        .select();

      if (insertError) {
        console.log('❌ Error inserting friend request:', insertError);
        return res.status(400).json({ error: insertError.message });
      }

      console.log('✅ Friend request sent from', requester_id, 'to', addressee_id, 'Result:', insertResult);
      const { error: notificationError } = await authenticatedSupabase.from('notifications').insert([
        {
          user_id: addressee_id,
          type: 'friend_request',
          reference_id: requester_id,
        },
      ]);

      if (notificationError) {
        console.log('⚠️ Could not create friend request notification:', notificationError);
      }
      res.json({ success: true, message: 'Friend request sent' });
    } catch (err) {
      console.log('💥 Exception in sendFriendRequest:', err);
      res.status(500).json({ error: err.message });
    }
  },
  async getFriendRequestStatus(req, res) {
    const supabase = getSupabase(req);
    const { userId } = req.params;
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const requesterId = userData.user.id;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('status')
        .or(
          `and(requester_id.eq.${requesterId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${requesterId})`
        )
        .single();

      if (error || !data) {
        return res.json({ status: 'none' }); // No friendship
      }

      res.json({ status: data.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async acceptFriendRequest(req, res) {
    const supabase = getSupabase(req);
    const { requester_id } = req.body;
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const addressee_id = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      const { error } = await authenticatedSupabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester_id', requester_id)
        .eq('addressee_id', addressee_id);

      if (error) return res.status(400).json({ error: error.message });
      const { error: notificationClearError } = await authenticatedSupabase
        .from('notifications')
        .delete()
        .eq('user_id', addressee_id)
        .eq('type', 'friend_request')
        .eq('reference_id', requester_id);

      if (notificationClearError) {
        console.log('⚠️ Unable to clear friend request notification:', notificationClearError);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async rejectFriendRequest(req, res) {
    const supabase = getSupabase(req);
    const { requester_id } = req.body;
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const addressee_id = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      const { error } = await authenticatedSupabase
        .from('friendships')
        .delete()
        .eq('requester_id', requester_id)
        .eq('addressee_id', addressee_id);

      if (error) return res.status(400).json({ error: error.message });
      const { error: notificationClearError } = await authenticatedSupabase
        .from('notifications')
        .delete()
        .eq('user_id', addressee_id)
        .eq('type', 'friend_request')
        .eq('reference_id', requester_id);

      if (notificationClearError) {
        console.log('⚠️ Unable to clear friend request notification:', notificationClearError);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async getAcceptedFriends(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;
    console.log('👥 Fetching accepted friends for user:', userId);

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      // Get friendships where status is accepted (either direction)
      const { data: friendships, error: friendError } = await authenticatedSupabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (friendError) {
        console.log('❌ Error fetching friendships:', friendError);
        return res.status(400).json({ error: friendError.message });
      }

      console.log('✅ Found', friendships?.length || 0, 'accepted friendships');

      if (!friendships || friendships.length === 0) {
        return res.json({ data: [] });
      }

      // Extract friend IDs (the other person in each friendship)
      const friendIds = friendships.map(f => 
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

      // Get profiles for all friends
      const { data: profiles, error: profileError } = await authenticatedSupabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url, bio')
        .in('user_id', friendIds);

      if (profileError) {
        console.log('⚠️ Error fetching friend profiles:', profileError);
        return res.json({ data: [] });
      }

      console.log('📤 Returning', profiles?.length || 0, 'friend profiles');
      res.json({ data: profiles || [] });
    } catch (err) {
      console.log('💥 Exception in getAcceptedFriends:', err);
      res.status(500).json({ error: err.message });
    }
  },
  async updateMyLocation(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { latitude, longitude } = req.body;


    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'latitude and longitude are required numbers' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      const { error } = await authenticatedSupabase
        .from('user_locations')
        .upsert(
          {
            user_id: userId,
            latitude,
            longitude,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );


      if (error) {
        if (error.code === '42P01') {
          return res.status(500).json({
            error: 'user_locations table is missing. Apply schema changes first.',
          });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async getFriendsLocations(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      const { data: friendships, error: friendError } = await authenticatedSupabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (friendError) return res.status(400).json({ error: friendError.message });
      if (!friendships || friendships.length === 0) return res.json({ data: [] });

      const friendIds = friendships.map((friendship) =>
        friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
      );

      const { data: profiles, error: profileError } = await authenticatedSupabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url, bio')
        .in('user_id', friendIds);

      if (profileError) return res.status(400).json({ error: profileError.message });

      const { data: locations, error: locationError } = await authenticatedSupabase
        .from('user_locations')
        .select('user_id, latitude, longitude, updated_at')
        .in('user_id', friendIds);

      if (locationError) {
        if (locationError.code === '42P01') {
          return res.status(500).json({
            error: 'user_locations table is missing. Apply schema changes first.',
          });
        }
        return res.status(400).json({ error: locationError.message });
      }

      const locationByUserId = new Map((locations || []).map((location) => [location.user_id, location]));

      const { data: intentRows, error: intentError } = await authenticatedSupabase
        .from('user_intent_preferences')
        .select('user_id, active_intent, active_intents, inner_radius_km, outer_radius_km')
        .in('user_id', friendIds);

      if (intentError) {
        if (intentError.code === '42P01') {
          return res.status(500).json({
            error: 'user_intent_preferences table is missing. Apply schema changes first.',
          });
        }
        return res.status(400).json({ error: intentError.message });
      }

      const intentsByUserId = new Map((intentRows || []).map((row) => [row.user_id, row]));

      const data = (profiles || []).map((profile) => {
        const location = locationByUserId.get(profile.user_id);
        const intentPrefs = intentsByUserId.get(profile.user_id);
        const normalizedActiveIntents =
          Array.isArray(intentPrefs?.active_intents) && intentPrefs.active_intents.length
            ? intentPrefs.active_intents
            : intentPrefs?.active_intent
              ? [intentPrefs.active_intent]
              : ['Free'];
        const normalizedInnerRadius =
          typeof intentPrefs?.inner_radius_km === 'number' ? intentPrefs.inner_radius_km : 1;
        const normalizedOuterRadius =
          typeof intentPrefs?.outer_radius_km === 'number' ? intentPrefs.outer_radius_km : 5;
        return {
          ...profile,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          location_updated_at: location?.updated_at ?? null,
          active_intents: normalizedActiveIntents,
          inner_radius_km: normalizedInnerRadius,
          outer_radius_km: normalizedOuterRadius,
        };
      });

      return res.json({ data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async getIncomingFriendRequests(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const addressee_id = userData.user.id;
    console.log('📥 Fetching incoming requests for user:', addressee_id);

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      // Get all pending friend requests where current user is addressee
      const { data: requests, error: requestError } = await authenticatedSupabase
        .from('friendships')
        .select('requester_id, status, created_at')
        .eq('addressee_id', addressee_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestError) {
        console.log('❌ Error fetching requests:', requestError);
        return res.status(400).json({ error: requestError.message });
      }

      console.log('✅ Found', requests?.length || 0, 'incoming requests');

      // If no requests, return empty array immediately
      if (!requests || requests.length === 0) {
        return res.json({ data: [] });
      }

      // Get profile info for each requester sequentially to avoid RLS issues
      const requestsWithProfiles = [];
      for (const request of requests) {
        try {
          const { data: profile, error: profileError } = await authenticatedSupabase
            .from('user_profiles')
            .select('user_id, full_name, profile_photo_url')
            .eq('user_id', request.requester_id)
            .single();

          if (profileError) {
            console.log('⚠️ Error fetching profile for requester', request.requester_id, ':', profileError);
          }

          requestsWithProfiles.push({
            requester_id: request.requester_id,
            name: profile?.full_name || 'Unknown User',
            photo_url: profile?.profile_photo_url || '',
            created_at: request.created_at
          });
        } catch (err) {
          console.log('⚠️ Exception getting profile:', err);
          requestsWithProfiles.push({
            requester_id: request.requester_id,
            name: 'Unknown User',
            photo_url: '',
            created_at: request.created_at
          });
        }
      }

      console.log('📤 Returning', requestsWithProfiles.length, 'requests with profiles');
      res.json({ data: requestsWithProfiles });
    } catch (err) {
      console.log('💥 Exception in getIncomingFriendRequests:', err);
      res.status(500).json({ error: err.message });
    }
  },
  async getNotifications(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data: notifications, error: notificationsError } = await authenticatedSupabase
        .from('notifications')
        .select('notification_id, type, reference_id, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (notificationsError) {
        return res.status(400).json({ error: formatSupabaseError(notificationsError, 'Failed to load notifications') });
      }

      const rows = notifications || [];

      const friendRequestIds = rows
        .filter((row) => row.type === 'friend_request' && row.reference_id)
        .map((row) => row.reference_id);
      const hangoutIds = rows
        .filter((row) => (row.type === 'hangout_invite' || row.type === 'hangout_joined') && row.reference_id)
        .map((row) => row.reference_id);
      const messageRefs = rows
        .filter((row) => row.type === 'message' && row.reference_id)
        .map((row) => row.reference_id);

      const uniqueIds = (items) => Array.from(new Set(items.filter(Boolean)));
      const friendIds = uniqueIds(friendRequestIds);
      const hangoutIdList = uniqueIds(hangoutIds);
      const messageRefList = uniqueIds(messageRefs);

      let friendProfilesById = {};
      if (friendIds.length) {
        const { data: profiles, error: profileError } = await authenticatedSupabase
          .from('user_profiles')
          .select('user_id, full_name, username, profile_photo_url')
          .in('user_id', friendIds);

        if (profileError) {
          return res.status(400).json({ error: formatSupabaseError(profileError, 'Failed to load profiles') });
        }

        friendProfilesById = Object.fromEntries((profiles || []).map((row) => [row.user_id, row]));
      }

      let hangoutsById = {};
      let creatorProfilesById = {};
      if (hangoutIdList.length) {
        const { data: hangouts, error: hangoutError } = await authenticatedSupabase
          .from('hangouts')
          .select('hangout_id, title, description, creator_id')
          .in('hangout_id', hangoutIdList);

        if (hangoutError) {
          return res.status(400).json({ error: formatSupabaseError(hangoutError, 'Failed to load hangouts') });
        }

        hangoutsById = Object.fromEntries((hangouts || []).map((row) => [row.hangout_id, row]));

        const creatorIds = uniqueIds((hangouts || []).map((row) => row.creator_id));
        if (creatorIds.length) {
          const { data: creators, error: creatorError } = await authenticatedSupabase
            .from('user_profiles')
            .select('user_id, full_name, username, profile_photo_url')
            .in('user_id', creatorIds);

          if (creatorError) {
            return res.status(400).json({ error: formatSupabaseError(creatorError, 'Failed to load creators') });
          }

          creatorProfilesById = Object.fromEntries((creators || []).map((row) => [row.user_id, row]));
        }
      }

      let messagesByRef = {};
      let senderProfilesById = {};
      let groupChatsById = {};
      let groupMembersByGroupId = {};

      if (messageRefList.length) {
        const { data: messageByIdRows, error: messageError } = await authenticatedSupabase
          .from('messages')
          .select('message_id, group_id, sender_id, message_type, created_at')
          .in('message_id', messageRefList);

        if (messageError) {
          return res.status(400).json({ error: formatSupabaseError(messageError, 'Failed to load messages') });
        }

        const matchedMessageIds = new Set((messageByIdRows || []).map((row) => row.message_id));
        const groupIdRefs = messageRefList.filter((ref) => !matchedMessageIds.has(ref));

        const messagesById = Object.fromEntries((messageByIdRows || []).map((row) => [row.message_id, row]));
        messagesByRef = { ...messagesByRef, ...messagesById };

        let groupMessageRows = [];
        if (groupIdRefs.length) {
          const { data: groupMessages, error: groupMessageError } = await authenticatedSupabase
            .from('messages')
            .select('message_id, group_id, sender_id, message_type, created_at')
            .in('group_id', groupIdRefs)
            .order('created_at', { ascending: false })
            .limit(200);

          if (groupMessageError) {
            return res.status(400).json({ error: formatSupabaseError(groupMessageError, 'Failed to load messages') });
          }

          groupMessageRows = groupMessages || [];
          const latestByGroup = {};
          for (const message of groupMessageRows) {
            if (!latestByGroup[message.group_id]) {
              latestByGroup[message.group_id] = message;
            }
          }

          for (const [groupId, message] of Object.entries(latestByGroup)) {
            messagesByRef[groupId] = message;
          }
        }

        const senderIds = uniqueIds([
          ...Object.values(messagesByRef).map((row) => row.sender_id),
        ]);
        if (senderIds.length) {
          const { data: senders, error: senderError } = await authenticatedSupabase
            .from('user_profiles')
            .select('user_id, full_name, username, profile_photo_url')
            .in('user_id', senderIds);

          if (senderError) {
            return res.status(400).json({ error: formatSupabaseError(senderError, 'Failed to load senders') });
          }

          senderProfilesById = Object.fromEntries((senders || []).map((row) => [row.user_id, row]));
        }

        const groupIds = uniqueIds(Object.values(messagesByRef).map((row) => row.group_id));
        if (groupIds.length) {
          const { data: groupChats, error: groupChatError } = await authenticatedSupabase
            .from('group_chats')
            .select('group_id, hangout_id, is_temporary')
            .in('group_id', groupIds);

          if (groupChatError) {
            return res.status(400).json({ error: formatSupabaseError(groupChatError, 'Failed to load group chats') });
          }

          groupChatsById = Object.fromEntries((groupChats || []).map((row) => [row.group_id, row]));

          const { data: members, error: membersError } = await authenticatedSupabase
            .from('group_members')
            .select('group_id, user_id')
            .in('group_id', groupIds);

          if (membersError) {
            return res.status(400).json({ error: formatSupabaseError(membersError, 'Failed to load group members') });
          }

          groupMembersByGroupId = (members || []).reduce((acc, row) => {
            acc[row.group_id] = acc[row.group_id] || [];
            acc[row.group_id].push(row.user_id);
            return acc;
          }, {});
        }
      }

      const data = rows.map((row) => {
        const actor = row.type === 'friend_request' ? friendProfilesById[row.reference_id] || null : null;
        const hangout = hangoutsById[row.reference_id] || null;
        const hangoutCreator = hangout ? creatorProfilesById[hangout.creator_id] || null : null;
        const message = messagesByRef[row.reference_id] || null;
        const groupChat = message ? groupChatsById[message.group_id] || null : null;
        const members = message ? groupMembersByGroupId[message.group_id] || [] : [];
        const counterpartUserId =
          message && groupChat && !groupChat.hangout_id
            ? members.find((memberId) => memberId !== userId) || null
            : null;

        return {
          ...row,
          actor,
          hangout: hangout
            ? {
                hangout_id: hangout.hangout_id,
                title: hangout.title,
                description: hangout.description,
                creator: hangoutCreator,
              }
            : null,
          message: message
            ? {
                message_id: message.message_id,
                group_id: message.group_id,
                message_type: message.message_type,
                sender: senderProfilesById[message.sender_id] || null,
                hangout_id: groupChat?.hangout_id || null,
                counterpart_user_id: counterpartUserId,
              }
            : null,
        };
      });

      return res.json({ data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
  async markNotificationRead(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({ error: 'notificationId is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error: updateError } = await authenticatedSupabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId)
        .eq('user_id', userId);

      if (updateError) {
        return res.status(400).json({ error: formatSupabaseError(updateError, 'Failed to update notification') });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getTrustedContacts(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data: contacts, error } = await authenticatedSupabase
        .from('trusted_contacts')
        .select(`
          contact_id,
          contact_user_id,
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return res.status(400).json({ error: error.message });

      // Fetch user profiles for each contact
      const contactUserIds = (contacts || []).map(c => c.contact_user_id);
      
      if (contactUserIds.length === 0) {
        return res.json({ data: [] });
      }

      const { data: profiles, error: profilesError } = await authenticatedSupabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url')
        .in('user_id', contactUserIds);

      if (profilesError) return res.status(400).json({ error: profilesError.message });

      const profileMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      const formattedContacts = (contacts || []).map(contact => ({
        contact_id: contact.contact_id,
        contact_user_id: contact.contact_user_id,
        created_at: contact.created_at,
        contact_profile: profileMap[contact.contact_user_id] || null
      }));

      res.json({ data: formattedContacts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async addTrustedContact(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { contact_user_id } = req.body;

    if (!contact_user_id) {
      return res.status(400).json({ error: 'contact_user_id is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    if (userId === contact_user_id) {
      return res.status(400).json({ error: 'Cannot add yourself as a trusted contact' });
    }

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);

      // Check if contact already exists
      const { data: existingContact } = await authenticatedSupabase
        .from('trusted_contacts')
        .select('contact_id')
        .eq('user_id', userId)
        .eq('contact_user_id', contact_user_id)
        .maybeSingle();

      if (existingContact) {
        return res.status(400).json({ error: 'This contact is already in your trusted contacts' });
      }

      // Add trusted contact
      const { data, error } = await authenticatedSupabase
        .from('trusted_contacts')
        .insert([{
          user_id: userId,
          contact_user_id
        }])
        .select();

      if (error) return res.status(400).json({ error: error.message });

      res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async removeTrustedContact(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { contact_user_id } = req.body;

    if (!contact_user_id) {
      return res.status(400).json({ error: 'contact_user_id is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      
      const { error } = await authenticatedSupabase
        .from('trusted_contacts')
        .delete()
        .eq('user_id', userId)
        .eq('contact_user_id', contact_user_id);

      if (error) return res.status(400).json({ error: error.message });

      res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getBlockedUsers(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data: blocks, error } = await authenticatedSupabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) return res.status(400).json({ error: error.message });

      const blockedIds = (blocks || []).map((entry) => entry.blocked_id);
      if (blockedIds.length === 0) return res.json({ data: [] });

      const { data: profiles, error: profilesError } = await authenticatedSupabase
        .from('user_profiles')
        .select('user_id, full_name, username, profile_photo_url')
        .in('user_id', blockedIds);

      if (profilesError) return res.status(400).json({ error: profilesError.message });

      const profileMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      const blockedUsers = blockedIds.map((blockedId) => ({
        blocked_user_id: blockedId,
        blocked_profile: profileMap[blockedId] || null,
      }));

      res.json({ data: blockedUsers });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async blockUser(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { blocked_user_id } = req.body;

    if (!blocked_user_id) {
      return res.status(400).json({ error: 'blocked_user_id is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = userData.user.id;

    if (userId === blocked_user_id) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { data: existingBlock, error: existingError } = await authenticatedSupabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId)
        .eq('blocked_id', blocked_user_id)
        .maybeSingle();

      if (existingError) return res.status(400).json({ error: existingError.message });
      if (existingBlock) return res.status(400).json({ error: 'User is already blocked' });

      const { error } = await authenticatedSupabase.from('blocks').insert([
        {
          blocker_id: userId,
          blocked_id: blocked_user_id,
        },
      ]);

      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async unblockUser(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { blocked_user_id } = req.body;

    if (!blocked_user_id) {
      return res.status(400).json({ error: 'blocked_user_id is required' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = userData.user.id;

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error } = await authenticatedSupabase
        .from('blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', blocked_user_id);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  async reportUser(req, res) {
    const supabase = getSupabase(req);
    const token = req.supabaseToken;
    const { reported_user_id, reason } = req.body;

    if (!reported_user_id) {
      return res.status(400).json({ error: 'reported_user_id is required' });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to file a report' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = userData.user.id;

    if (userId === reported_user_id) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    try {
      const authenticatedSupabase = await createAuthenticatedClient(token);
      const { error } = await authenticatedSupabase.from('reports').insert([
        {
          reporter_id: userId,
          reported_user_id,
          reason: reason.trim(),
        },
      ]);

      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};

export default UserController;