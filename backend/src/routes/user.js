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

// Friends & Search endpoints
router.get('/search', requireAuth, UserController.searchUsers);
router.get('/friends', requireAuth, UserController.getAcceptedFriends);
router.get('/friends/locations', requireAuth, UserController.getFriendsLocations);
router.post('/location', requireAuth, UserController.updateMyLocation);
router.get('/friend-requests/incoming', requireAuth, UserController.getIncomingFriendRequests);
router.get('/:userId/profile', requireAuth, UserController.getUserProfile);
router.get('/:userId/friend-status', requireAuth, UserController.getFriendRequestStatus);
router.post('/friend-request/send', requireAuth, UserController.sendFriendRequest);
router.post('/friend-request/accept', requireAuth, UserController.acceptFriendRequest);
router.post('/friend-request/reject', requireAuth, UserController.rejectFriendRequest);
// Session timeout handled via middleware

export default router;