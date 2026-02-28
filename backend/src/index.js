

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import userRoutes from './routes/user.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));

// Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
app.set('supabase', supabase);

app.use(express.json());

// Shortcut routes for registration and login
app.post('/register', async (req, res) => {
	const { email, password } = req.body;
	try {
		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) return res.status(400).json({ error: error.message });
		res.json({ user: data.user });
	} catch (err) {
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

app.use('/api/user', userRoutes);

app.listen(process.env.PORT || 3001, () => {
	console.log('Backend running on port ' + (process.env.PORT || 3001));
});
