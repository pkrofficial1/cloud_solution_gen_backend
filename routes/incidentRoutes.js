const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { protect } = require('../middleware/auth');

// Get all incidents
router.get('/', incidentController.getAll);

// Get a single incident
router.get('/:id', incidentController.getById);

// Create a new incident
router.post('/', protect, incidentController.create);

// Upvote an incident
router.post('/:id/upvote', protect, incidentController.upvote);

// Vote on a poll
router.post('/:id/vote', protect, incidentController.vote);

router.delete('/:id/vote', protect, incidentController.removeVote);

// Get comments for an incident
router.get('/:id/comments', incidentController.getComments);

// Add a comment to an incident
router.post('/:id/comments', protect, incidentController.addComment);

// Add a reply to a comment
router.post('/:id/comments/:commentId/replies', protect, incidentController.addReply);

router.get('/user/:userId', incidentController.getUserIncidents);

module.exports = router;