const Incident = require('../models/Incident');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper function to check if a poll has ended
const isPollEnded = (incident) => {
  if (!incident.endDate) return false;
  return new Date() > new Date(incident.endDate);
};

// Get all incidents
exports.getAll = async (req, res) => {
  try {
    const incidents = await Incident.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    // Add hasVoted flag for the current user
    const enhancedIncidents = incidents.map(incident => {
      const incidentObj = incident.toObject();
      
      // Check if current user has voted on this incident
      if (req.user && incident.voters) {
        incidentObj.hasVoted = incident.voters.some(voter => 
          voter.toString() === req.user._id.toString() ||
          (voter.user && voter.user.toString() === req.user._id.toString())
        );
        
        // For polls, get which option the user voted for
        if (incident.type === 'poll') {
          const userVote = incident.voters.find(voter => {
            if (typeof voter === 'object' && voter.user) {
              return voter.user.toString() === req.user._id.toString();
            }
            return false;
          });
          
          if (userVote && userVote.optionIndex !== undefined) {
            incidentObj.userVotedOption = userVote.optionIndex;
          }
        }
      }
      
      // For polls, check if ended
      if (incident.type === 'poll') {
        incidentObj.isEnded = isPollEnded(incident);
      }
      
      return incidentObj;
    });
    
    return res.json({
      success: true,
      data: enhancedIncidents
    });
  } catch (err) {
    console.error('Error fetching incidents:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get a single incident by ID
exports.getById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('user', 'name email')
      .populate('comments.user', 'name email')
      .populate('comments.replies.user', 'name email');
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }
    
    const incidentObj = incident.toObject();
    
    // Check if current user has voted
    if (req.user && incident.voters) {
      incidentObj.hasVoted = incident.voters.some(voter => {
        if (typeof voter === 'object' && voter.user) {
          return voter.user.toString() === req.user._id.toString();
        }
        return voter.toString() === req.user._id.toString();
      });
      
      // For polls, get which option the user voted for
      if (incident.type === 'poll') {
        const userVote = incident.voters.find(voter => {
          if (typeof voter === 'object' && voter.user) {
            return voter.user.toString() === req.user._id.toString();
          }
          return false;
        });
        
        if (userVote && userVote.optionIndex !== undefined) {
          incidentObj.userVotedOption = userVote.optionIndex;
        }
      }
    }
    
    // For polls, check if ended
    if (incident.type === 'poll') {
      incidentObj.isEnded = isPollEnded(incident);
    }
    
    return res.json({
      success: true,
      data: incidentObj
    });
  } catch (err) {
    console.error('Error fetching incident:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Create a new incident
exports.create = async (req, res) => {
  try {
    const { type, title, description, provider, tags, ...typeSpecificData } = req.body;
    
    // Create base incident object
    const incidentData = {
      type,
      title,
      description,
      provider,
      tags: tags || [],
      user: req.user._id
    };
    
    // Add type-specific fields
    if (type === 'issue') {
      const { timestamp, service, urgency, components, category, region } = typeSpecificData;
      Object.assign(incidentData, {
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        service,
        urgency: urgency || 'medium',
        components: components || [],
        category,
        region
      });
    } else if (type === 'poll') {
      const { question, options, duration } = typeSpecificData;
      
      // Example of formatting options
      const formattedOptions = options.map(option => ({ text: option, votes: 0 }));
      
      Object.assign(incidentData, {
        question: question || title,
        options: formattedOptions,
        duration: duration || 7
      });
      
      // Calculate end date
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(duration || 7));
      incidentData.endDate = endDate;
    } else if (type === 'news') {
      const { newsDate, sourceUrl, excerpt } = typeSpecificData;
      Object.assign(incidentData, {
        newsDate: newsDate ? new Date(newsDate) : new Date(),
        sourceUrl,
        excerpt
      });
    }
    
    const incident = new Incident(incidentData);
    await incident.save();
    
    return res.status(201).json({
      success: true,
      data: incident
    });
  } catch (err) {
    console.error('Error creating incident:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
};

// Upvote an incident
exports.upvote = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    // Check if user has already voted
    if (incident.voters && incident.voters.some(voter => {
      if (typeof voter === 'object' && voter.user) {
        return voter.user.toString() === req.user._id.toString();
      }
      return voter.toString() === req.user._id.toString();
    })) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted on this incident'
      });
    }

    // Only update votes and voters, skip options validation
    const updatedIncident = await Incident.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { votes: 1 },
        $push: { voters: req.user._id }
      },
      { new: true, runValidators: false }
    );

    return res.json({
      success: true,
      data: {
        votes: updatedIncident.votes,
        hasVoted: true
      }
    });
  } catch (err) {
    console.error('Error upvoting incident:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Vote on a poll
exports.vote = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({
        success: false,
        message: 'Option index is required'
      });
    }
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }
    if (incident.type !== 'poll') {
      return res.status(400).json({
        success: false,
        message: 'This incident is not a poll'
      });
    }
    if (isPollEnded(incident)) {
      return res.status(400).json({
        success: false,
        message: 'This poll has ended'
      });
    }
    if (optionIndex < 0 || optionIndex >= incident.options.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid option index'
      });
    }
    const previousVote = incident.voters.find(voter => voter.user.toString() === req.user._id.toString());
    if (previousVote) {
      incident.voters = incident.voters.filter(voter => voter.user.toString() !== req.user._id.toString());
      if (incident.options[previousVote.optionIndex]) {
        incident.options[previousVote.optionIndex].votes = Math.max(0, (incident.options[previousVote.optionIndex].votes || 0) - 1);
      }
    }
    incident.voters.push({
      user: req.user._id,
      optionIndex: optionIndex
    });
    if (incident.options[optionIndex]) {
      incident.options[optionIndex].votes = (incident.options[optionIndex].votes || 0) + 1;
    }
    await incident.save();
    return res.json({
      success: true,
      data: {
        options: incident.options,
        hasVoted: true,
        userVotedOption: optionIndex
      }
    });
  } catch (err) {
    console.error('Error voting on poll:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get comments for an incident
exports.getComments = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('comments.user', 'name email')
      .populate('comments.replies.user', 'name email');
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }
    
    return res.json({
      success: true,
      data: incident.comments || []
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getUserIncidents = async (req, res) => {
  try {
    console.log('Fetching incidents for user:', req.params.userId); // Add this line
    const incidents = await Incident.find({ user: req.params.userId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    console.log('Found incidents:', incidents.length); // Add this line
    // Add hasVoted flag for the current user, similar to getAll method
    const enhancedIncidents = incidents.map(incident => {
      const incidentObj = incident.toObject();
      
      // Check if current user has voted on this incident
      if (req.user && incident.voters) {
        incidentObj.hasVoted = incident.voters.some(voter => 
          voter.toString() === req.user._id.toString() ||
          (voter.user && voter.user.toString() === req.user._id.toString())
        );
      }
      
      // For polls, check if ended
      if (incident.type === 'poll') {
        incidentObj.isEnded = isPollEnded(incident);
      }
      
      return incidentObj;
    });
    
    return res.json({
      success: true,
      data: enhancedIncidents
    });
  } catch (err) {
    console.error('Error fetching user incidents:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add a comment to an incident
exports.addComment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }
    
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }
    
    const comment = {
      text,
      user: req.user._id,
      createdAt: new Date()
    };
    
    incident.comments = incident.comments || [];
    incident.comments.push(comment);
    await incident.save();
    
    // Get the newly added comment with populated user
    const updatedIncident = await Incident.findById(req.params.id)
      .populate('comments.user', 'name email');
    
    const newComment = updatedIncident.comments[updatedIncident.comments.length - 1];
    
    return res.status(201).json({
      success: true,
      data: newComment
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add a reply to a comment
exports.addReply = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { text } = req.body;
    const { id, commentId } = req.params;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required'
      });
    }
    
    const incident = await Incident.findById(id);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }
    
    // Find the comment to reply to
    const comment = incident.comments.id(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    const reply = {
      text,
      user: req.user._id,
      createdAt: new Date()
    };
    
    comment.replies = comment.replies || [];
    comment.replies.push(reply);
    await incident.save();
    
    // Get the newly added reply with populated user
    const updatedIncident = await Incident.findById(id)
      .populate('comments.replies.user', 'name email');
    
    const updatedComment = updatedIncident.comments.id(commentId);
    const newReply = updatedComment.replies[updatedComment.replies.length - 1];
    
    return res.status(201).json({
      success: true,
      data: newReply
    });
  } catch (err) {
    console.error('Error adding reply:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Remove vote from a poll
exports.removeVote = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const incident = await Incident.findById(req.params.id);
    if (!incident || incident.type !== 'poll') {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }
    // Find user's vote
    const userVote = incident.voters.find(v => v.user.toString() === req.user._id.toString());
    if (!userVote) {
      return res.status(400).json({ success: false, message: 'You have not voted on this poll' });
    }
    // Decrement vote count for the option
    if (incident.options[userVote.optionIndex]) {
      incident.options[userVote.optionIndex].votes = Math.max(0, (incident.options[userVote.optionIndex].votes || 0) - 1);
    }
    // Remove user from voters
    incident.voters = incident.voters.filter(v => v.user.toString() !== req.user._id.toString());
    await incident.save();
    return res.json({ success: true, data: { options: incident.options, hasVoted: false } });
  } catch (err) {
    console.error('Error removing vote:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};