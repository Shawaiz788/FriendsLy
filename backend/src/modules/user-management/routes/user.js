import express from 'express';
import multer from 'multer';
import UserController from '../controllers/UserController.js';
import HangoutController from '../controllers/HangoutController.js';
import MediaController from '../controllers/MediaController.js';
import StoryController from '../controllers/StoryController.js';
import {
  createCollaborativePost,
  getCollaborativePosts,
  addCollaborator,
  removeCollaborator,
  updateCollaborativePost,
  deleteCollaborativePost
} from '../controllers/CollaborativePostController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const sessionIdleTimeoutMs = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 30) * 60 * 1000;
const lastSeenByToken = new Map();

const decodeJwtPayload = (token) => {
	try {
		const payloadPart = token.split('.')[1];
		if (!payloadPart) return null;
		const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
	} catch {
		return null;
	}
};

// Middleware to check Supabase JWT + idle timeout
function requireAuth(req, res, next) {
	const rawAuth = req.headers['authorization'] || '';
	const token = String(rawAuth).replace(/^Bearer\s+/i, '').trim();
	if (!token) return res.status(401).json({ error: 'Missing auth token' });

	// Basic JWT shape check (3 segments). Prevents confusing Supabase "Invalid Compact JWS" errors.
	if (token.split('.').length !== 3) {
		return res.status(401).json({ error: 'Invalid auth token (expected JWT)' });
	}

	const payload = decodeJwtPayload(token);
	if (payload?.exp && Date.now() >= payload.exp * 1000) {
		return res.status(401).json({ error: 'Session has expired' });
	}

	const lastSeen = lastSeenByToken.get(token);
	if (sessionIdleTimeoutMs > 0 && lastSeen && Date.now() - lastSeen > sessionIdleTimeoutMs) {
		lastSeenByToken.delete(token);
		return res.status(401).json({ error: 'Session timed out due to inactivity' });
	}

	lastSeenByToken.set(token, Date.now());
	req.supabaseToken = token;
	next();
}


// /me endpoint to get user info from token
router.get('/me', requireAuth, UserController.getMe);

router.post('/register', UserController.register);
// Check if username is available
router.get('/check-username', UserController.checkUsernameAvailability);
router.put('/profile', requireAuth, UserController.editProfile);
router.get('/e2ee/public-key', requireAuth, UserController.getMyE2eePublicKey);
router.put('/e2ee/public-key', requireAuth, UserController.setMyE2eePublicKey);
router.post('/deactivate', requireAuth, UserController.deactivateAccount);
router.delete('/delete', requireAuth, UserController.deleteAccount);
router.get('/download', requireAuth, UserController.downloadData);
router.post('/verify', requireAuth, UserController.verify);
router.post('/logout', requireAuth, UserController.logout);
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
router.post('/chats/direct', requireAuth, HangoutController.getOrCreateDirectChat);
router.get('/groups/:groupId/members', requireAuth, HangoutController.getGroupMembersWithKeys);
router.get('/groups/:groupId/e2ee-keys', requireAuth, HangoutController.getGroupE2eeKey);
router.post('/groups/:groupId/e2ee-keys', requireAuth, HangoutController.upsertGroupE2eeKeys);
router.get('/groups/:groupId/messages', requireAuth, HangoutController.getGroupMessages);
router.post('/groups/:groupId/messages', requireAuth, HangoutController.sendGroupMessage);
router.post('/groups/:groupId/polls/:pollId/vote', requireAuth, HangoutController.voteInPoll);
router.post('/groups/:groupId/media', requireAuth, upload.single('file'), HangoutController.uploadGroupMedia);

// Media (feed/posts)
router.get('/media/feed', requireAuth, MediaController.getFeed);
router.post('/media/upload', requireAuth, upload.single('file'), MediaController.uploadPostMedia);
router.post('/media/posts', requireAuth, MediaController.createPost);
router.post('/media/posts/:postId/like', requireAuth, MediaController.toggleLike);
router.get('/media/posts/:postId/comments', requireAuth, MediaController.getComments);
router.post('/media/posts/:postId/comments', requireAuth, MediaController.addComment);

// Stories (24-hour ephemeral content)
router.get('/stories', requireAuth, StoryController.getStories);
router.post('/stories/upload', requireAuth, upload.single('file'), StoryController.uploadStoryMedia);
router.post('/stories', requireAuth, StoryController.createStory);
router.delete('/stories/:storyId', requireAuth, StoryController.deleteStory);

// Collaborative Posts
router.get('/collaborative-posts', requireAuth, getCollaborativePosts);
router.post('/collaborative-posts', requireAuth, createCollaborativePost);
router.put('/collaborative-posts/:postId', requireAuth, updateCollaborativePost);
router.delete('/collaborative-posts/:postId', requireAuth, deleteCollaborativePost);
router.post('/collaborative-posts/:postId/collaborators', requireAuth, addCollaborator);
router.delete('/collaborative-posts/:postId/collaborators/:userId', requireAuth, removeCollaborator);

router.get('/capsules/:capsuleId', requireAuth, HangoutController.getCapsuleDetails);
router.post('/capsules/:capsuleId/reflections', requireAuth, HangoutController.addCapsuleReflection);
router.post('/capsules/:capsuleId/media', requireAuth, HangoutController.addCapsuleMedia);
router.delete('/capsules/:capsuleId/media/:mediaId', requireAuth, HangoutController.deleteCapsuleMedia);
router.get('/:userId/profile', requireAuth, UserController.getUserProfile);
router.get('/:userId/friend-status', requireAuth, UserController.getFriendRequestStatus);
router.post('/friend-request/send', requireAuth, UserController.sendFriendRequest);
router.post('/friend-request/accept', requireAuth, UserController.acceptFriendRequest);
router.post('/friend-request/reject', requireAuth, UserController.rejectFriendRequest);

// Trusted contacts
router.get('/trusted-contacts', requireAuth, UserController.getTrustedContacts);
router.post('/trusted-contacts/add', requireAuth, UserController.addTrustedContact);
router.post('/trusted-contacts/remove', requireAuth, UserController.removeTrustedContact);

// Block / report
router.get('/blocks', requireAuth, UserController.getBlockedUsers);
router.post('/blocks', requireAuth, UserController.blockUser);
router.delete('/blocks', requireAuth, UserController.unblockUser);
router.post('/reports', requireAuth, UserController.reportUser);

// Session timeout handled via middleware

export default router;