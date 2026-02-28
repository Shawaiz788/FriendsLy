// User controller for registration, profile, authentication


// UserController using ES module export
const getSupabase = (req) => req.app.get('supabase');

const UserController = {
  async register(req, res) {
    const supabase = getSupabase(req);
    const { email, phone, password, name, photo, interests } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      phone
    });
    if (error) return res.status(400).json({ error: error.message });
    const { error: profileError } = await supabase.from('profiles').insert([
      { id: data.user.id, name, photo, interests }
    ]);
    if (profileError) return res.status(400).json({ error: profileError.message });
    res.status(201).json({ user: data.user });
  },
  async editProfile(req, res) {
    const supabase = getSupabase(req);
    const { id, name, photo, interests } = req.body;
    const { error } = await supabase.from('profiles').update({ name, photo, interests }).eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
  async deactivateAccount(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.body;
    const { error } = await supabase.from('profiles').update({ isActive: false }).eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
  async deleteAccount(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.body;
    const { error } = await supabase.from('profiles').update({ deleted: true }).eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  },
  async downloadData(req, res) {
    const supabase = getSupabase(req);
    const { id } = req.query;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id);
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