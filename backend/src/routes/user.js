import express from 'express';
import UserController from '../controllers/UserController.js';

const router = express.Router();
router.post('/register', UserController.register);
router.put('/profile', UserController.editProfile);
router.post('/deactivate', UserController.deactivateAccount);
router.delete('/delete', UserController.deleteAccount);
router.get('/download', UserController.downloadData);
router.post('/verify', UserController.verify);
router.post('/logoutAll', UserController.logoutAll);
// Session timeout handled via middleware

export default router;