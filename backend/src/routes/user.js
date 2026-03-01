import express from 'express';
import UserController from '../controllers/UserController.js';

const router = express.Router();

// Middleware to check Supabase JWT
function requireAuth(req, res, next) {
	const token = req.headers['authorization']?.replace('Bearer ', '');
	if (!token) return res.status(401).json({ error: 'Missing auth token' });
	req.supabaseToken = token;
	next();
}


// /me endpoint to get user info from token
router.get('/me', requireAuth, UserController.getMe);

router.post('/register', UserController.register);
// Check if username is available
router.get('/check-username', UserController.checkUsernameAvailability);
router.put('/profile', requireAuth, UserController.editProfile);
router.post('/deactivate', requireAuth, UserController.deactivateAccount);
router.delete('/delete', requireAuth, UserController.deleteAccount);
router.get('/download', requireAuth, UserController.downloadData);
router.post('/verify', requireAuth, UserController.verify);
router.post('/logoutAll', requireAuth, UserController.logoutAll);
// Session timeout handled via middleware

export default router;