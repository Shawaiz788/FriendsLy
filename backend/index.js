
import express from 'express';
import cors from 'cors';
import { registerUser, loginUser } from './auth.js';

const app = express();
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use(express.json());

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await registerUser(email, password);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await loginUser(email, password);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ session: data.session, user: data.user });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
