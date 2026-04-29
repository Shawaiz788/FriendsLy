import express from 'express';
import multer from 'multer';
import UserController from '../controllers/UserController.js';
import HangoutController from '../controllers/HangoutController.js';
import MediaController from '../controllers/MediaController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Middleware to check Supabase JWT
function requireAuth(req, res, next) {
	const rawAuth = req.headers['authorization'] || '';
	const token = String(rawAuth).replace(/^Bearer\s+/i, '').trim();
	if (!token) return res.status(401).json({ error: 'Missing auth token' });

	// Basic JWT shape check (3 segments). Prevents confusing Supabase "Invalid Compact JWS" errors.
	if (token.split('.').length !== 3) {
		return res.status(401).json({ error: 'Invalid auth token (expected JWT)' });
	}

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
router.get('/intent-preferences', requireAuth, UserController.getMyIntentPreferences);
router.put('/intent-preferences', requireAuth, UserController.upsertMyIntentPreferences);
router.get('/friend-requests/incoming', requireAuth, UserController.getIncomingFriendRequests);
router.post('/hangouts/suggested/accept', requireAuth, HangoutController.acceptSuggestedHangout);
router.get('/hangouts/invites', requireAuth, HangoutController.getMyHangoutInvites);
router.post('/hangouts/:hangoutId/respond', requireAuth, HangoutController.respondToHangoutInvite);
router.get('/hangouts/mine', requireAuth, HangoutController.getMyHangouts);
router.get('/groups/:groupId/messages', requireAuth, HangoutController.getGroupMessages);
router.post('/groups/:groupId/messages', requireAuth, HangoutController.sendGroupMessage);
router.post('/groups/:groupId/media', requireAuth, upload.single('file'), HangoutController.uploadGroupMedia);

// Media (feed/posts)
router.get('/media/feed', requireAuth, MediaController.getFeed);
router.post('/media/upload', requireAuth, upload.single('file'), MediaController.uploadPostMedia);
router.post('/media/posts', requireAuth, MediaController.createPost);
router.post('/media/posts/:postId/like', requireAuth, MediaController.toggleLike);
router.get('/media/posts/:postId/comments', requireAuth, MediaController.getComments);
router.post('/media/posts/:postId/comments', requireAuth, MediaController.addComment);

router.get('/capsules/:capsuleId', requireAuth, HangoutController.getCapsuleDetails);
router.post('/capsules/:capsuleId/reflections', requireAuth, HangoutController.addCapsuleReflection);
router.get('/:userId/profile', requireAuth, UserController.getUserProfile);
router.get('/:userId/friend-status', requireAuth, UserController.getFriendRequestStatus);
router.post('/friend-request/send', requireAuth, UserController.sendFriendRequest);
router.post('/friend-request/accept', requireAuth, UserController.acceptFriendRequest);
router.post('/friend-request/reject', requireAuth, UserController.rejectFriendRequest);
// Session timeout handled via middleware

export default router;