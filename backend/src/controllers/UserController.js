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
    
    // Get user id from token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid token' });
    
    const userId = userData.user.id;
    
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
      // Upload file to Supabase Storage
      const fileName = `${userId}-${Date.now()}-${req.file.originalname}`;
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });
      
      if (error) {
        console.log('Storage upload error:', error);
        return res.status(400).json({ error: error.message });
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        return res.status(400).json({ error: 'Failed to get public URL' });
      }
      
      res.json({ url: publicUrl });
    } catch (err) {
      console.log('Upload error:', err);
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
    // Check if profile exists
    const { data: profileRows, error: selectError } = await supabase.from('user_profiles').select('profile_id').eq('user_id', userId);
    if (selectError) return res.status(400).json({ error: selectError.message });
    if (profileRows && profileRows.length > 0) {
      // Update existing profile
      const { error } = await supabase.from('user_profiles').update({
        full_name: name,
        username: username,
        profile_photo_url: photo,
        bio: interests,
        date_of_birth: date_of_birth,
        gender: gender
      }).eq('user_id', userId);
      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true, action: 'updated' });
    } else {
      // Insert user row if missing
      const { data: userRows, error: userSelectError } = await supabase.from('users').select('user_id').eq('user_id', userId);
      if (userSelectError) return res.status(400).json({ error: userSelectError.message });
      if (!userRows || userRows.length === 0) {
        // Insert user with minimal info (email, phone unknown, password_hash required)
        await supabase.from('users').insert([
          {
            user_id: userId,
            email: null,
            phone: null,
            password_hash: 'placeholder' // required by schema
          }
        ]);
      }
      // Insert new profile with all fields
      const { error } = await supabase.from('user_profiles').insert([
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
      if (error) return res.status(400).json({ error: error.message });
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
    // Query by user_id, not profile_id
    const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', id);
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
  }
};

export default UserController;