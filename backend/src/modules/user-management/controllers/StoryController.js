const express = require('express');
const router = express.Router();
const { Story } = require('../models/story'); // Assumed Story model exists

// Create a new story
router.post('/stories', async (req, res) => {
    try {
        const story = new Story({ ...req.body, createdAt: new Date() });
        await story.save();
        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Retrieve all stories
router.get('/stories', async (req, res) => {
    try {
        const stories = await Story.find();
        res.status(200).json(stories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Retrieve a specific story by ID
router.get('/stories/:id', async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.status(200).json(story);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a specific story by ID
router.delete('/stories/:id', async (req, res) => {
    try {
        const story = await Story.findByIdAndDelete(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Middleware to expire stories after 24 hours
router.use((req, res, next) => {
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();
    Story.deleteMany({ createdAt: { $lt: new Date(now - expirationTime) } }).exec();
    next();
});

module.exports = router;