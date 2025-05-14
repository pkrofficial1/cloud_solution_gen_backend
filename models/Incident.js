const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Reply schema (nested in comments)
const ReplySchema = new Schema({
  text: {
    type: String,
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Comment schema
const CommentSchema = new Schema({
  text: {
    type: String,
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  replies: [ReplySchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Poll option schema
const PollOptionSchema = new Schema({
  text: {
    type: String,
    required: true
  },
  votes: {
    type: Number,
    default: 0
  }
});

// Incident schema
const IncidentSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['issue', 'question', 'poll', 'news']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  provider: {
    type: String
  },
  tags: [String],
  votes: {
    type: Number,
    default: 0
  },
  voters: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [CommentSchema],
  
  // Fields for issue type
  timestamp: Date,
  service: String,
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  components: [String],
  category: String,
  region: String,
  
  // Fields for poll type
  question: String,
  options: [PollOptionSchema],
  duration: {
    type: Number,
    default: 7
  },
  endDate: Date,
  voters: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    optionIndex: {
      type: Number,
      required: true
    }
  }],
  
  // Fields for news type
  newsDate: Date,
  sourceUrl: String,
  excerpt: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to set endDate for polls
IncidentSchema.pre('save', function(next) {
  if (this.isNew && this.type === 'poll' && this.duration && !this.endDate) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + this.duration);
    this.endDate = endDate;
  }
  next();
});

module.exports = mongoose.model('Incident', IncidentSchema);