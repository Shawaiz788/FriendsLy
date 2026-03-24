// User controller for registration, profile, authentication

// UserController using ES module export
const getSupabase = (req) => req.app.get('supabase');

const UserController = {
    async checkUsernameAvailability(req, res) {
      const supabase = getSupabase(req);
      const { username } = req.query;
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      const { data, error } = await supabase.from('user_profiles').select('username').eq('username', username);
      if (error) return res.status(500).json({ error: error.message });
      if (data && data.length > 0) {
        return res.json({ available: false });
      } else {
        return res.json({ available: true });
      }
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
        return res.status(400).json({ error: error.message });
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
    res.status(201).json({ user: authData.user });
  },
  async editProfile(req, res) {
    const supabase = getSupabase(req);
    const { name, username, photo, interests, date_of_birth, gender } = req.body;
    const token = req.supabaseToken;
    
    // Get user id from token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid token' });
    const userId = userData.user.id;
    
    // Create an authenticated client with the user's token for RLS
    const { createClient } = await import('@supabase/supabase-js');
    const authenticatedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
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
        gender: gender
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
          gender: gender
        }
      ]);
      if (error) {
        console.log('Profile insert error:', error);
        return res.status(400).json({ error: error.message });
      }
      res.json({ success: true, action: 'inserted' });
    }
  },
  async deactivateAccount(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.body;
    const { error } = await supabase.from('user_profiles').update({ isActive: false }).eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
  async deleteAccount(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.body;
    const { error } = await supabase.from('user_profiles').update({ deleted: true }).eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
  async downloadData(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.query;
    const token = req.supabaseToken;
    
    // Verify the token and user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid token' });
    
    // Create authenticated client for RLS
    const { createClient } = await import('@supabase/supabase-js');
    const authenticatedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Query by user_id, not profile_id
    const { data, error } = await authenticatedSupabase.from('user_profiles').select('*').eq('user_id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data });
  },
  async verify(req, res) {
    res.json({ message: 'Verification handled by Supabase.' });
  },
  async logoutAll(req, res) {
    res.json({ message: 'Logout from all devices is handled by password change.' });
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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { error } = await authenticatedSupabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester_id', requester_id)
        .eq('addressee_id', addressee_id);

      if (error) return res.status(400).json({ error: error.message });
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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { error } = await authenticatedSupabase
        .from('friendships')
        .delete()
        .eq('requester_id', requester_id)
        .eq('addressee_id', addressee_id);

      if (error) return res.status(400).json({ error: error.message });
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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

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

      const data = (profiles || []).map((profile) => {
        const location = locationByUserId.get(profile.user_id);
        return {
          ...profile,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          location_updated_at: location?.updated_at ?? null,
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
      const { createClient } = await import('@supabase/supabase-js');
      const authenticatedSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

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
  }
};

export default UserController;