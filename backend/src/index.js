

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import userRoutes from './modules/user-management/routes/user.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
app.set('supabase', supabase);

app.use(express.json({ limit: '10mb' }));

// Shortcut routes for registration and login
app.post('/register', async (req, res) => {
	const { email, password, name, phone, username, photo, interests, date_of_birth, gender } = req.body;
	console.log('========== REGISTRATION REQUEST ==========');
	console.log('Full payload:', JSON.stringify(req.body, null, 2));
	
	// Validate required fields
	if (!email || !password || !name || !username) {
		console.log('VALIDATION FAILED - Missing required fields');
		return res.status(400).json({ error: 'Missing required fields: email, password, name, username' });
	}
	console.log('VALIDATION PASSED');
	
	try {
		// 1. Create auth user
		console.log('Step 1: Creating auth user');
		const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, phone });
		if (authError) {
			console.log('Auth error:', authError);
			return res.status(400).json({ error: authError.message });
		}
		console.log('Auth user created:', authData.user.id);
		
		// 2. Insert into users table
		console.log('Step 2: Inserting into users table');
		const { error: userError } = await supabase.from('users').insert([
			{
				user_id: authData.user.id,
				email: email,
				phone: phone,
				password_hash: password
			}
		]);
		if (userError) {
			console.log('User insertion error:', userError);
			return res.status(400).json({ error: userError.message });
		}
		console.log('User inserted successfully');
		
		// 3. Insert into user_profiles table
		console.log('Step 3: Inserting into user_profiles');
		console.log('Inserting with data:', {
			user_id: authData.user.id,
			full_name: name,
			username: username,
			profile_photo_url: photo,
			bio: interests,
			date_of_birth: date_of_birth,
			gender: gender
		});
		
		const { data: profileData, error: profileError } = await supabase.from('user_profiles').insert([
			{
				user_id: authData.user.id,
				full_name: name,
				username: username,
				profile_photo_url: photo,
				bio: interests,
				date_of_birth: date_of_birth,
				gender: gender
			}
		]).select();
		console.log('Profile insert response - data:', profileData);
		console.log('Profile insert response - error:', profileError);
		if (profileError) {
			console.log('Profile insertion error details:', JSON.stringify(profileError, null, 2));
			return res.status(400).json({ error: profileError.message });
		}
		console.log('Profile inserted successfully, data:', profileData);
		res.json({ user: authData.user });
	} catch (err) {
		console.log('Exception:', err);
		res.status(500).json({ error: err.message });
	}
});

app.post('/login', async (req, res) => {
	const { email, password } = req.body;
	try {
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) return res.status(400).json({ error: error.message });
		res.json({ session: data.session, user: data.user });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// File upload route with multer middleware
app.post('/api/user/upload-image', upload.single('file'), async (req, res) => {
	const userRoutes = (await import('./modules/user-management/routes/user.js')).default;
	// This is a hack - call the controller directly
	const UserController = (await import('./modules/user-management/controllers/UserController.js')).default;
	
	const token = req.headers['authorization']?.replace('Bearer ', '');
	req.supabaseToken = token;
	req.app.set('supabase', supabase);
	
	await UserController.uploadImage(req, res);
});

app.use('/api/user', userRoutes);

// Automatic cleanup of expired stories (runs every hour)
const cleanupExpiredStories = async () => {
	try {
		const { createClient } = await import('@supabase/supabase-js');
		const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
		
		const now = new Date().toISOString();
		const { error } = await adminSupabase
			.from('stories')
			.delete()
			.lt('expires_at', now);
			
		if (error) {
			console.log('Error cleaning up expired stories:', error.message);
		} else {
			console.log('✅ Cleaned up expired stories');
		}
	} catch (err) {
		console.log('Exception during story cleanup:', err.message);
	}
};

// Run cleanup every hour (3600000 ms)
setInterval(cleanupExpiredStories, 3600000);

// Run cleanup once on startup
cleanupExpiredStories();

app.listen(process.env.PORT || 3001, () => {
	console.log('Backend running on port ' + (process.env.PORT || 3001));
});
