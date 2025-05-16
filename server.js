const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth.routes');
const incidentRoutes = require('./routes/incidentRoutes');
const knowledgeBaseRoutes = require('./routes/knowledgeBase.routes');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Enable JSON parsing
app.use(express.json());

// CORS middleware FIRST (before routes)
const corsOptions = {
  origin: ['https://blue-flower-0e3054f00.6.azurestaticapps.net','http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Debug incoming requests (helpful for deployment debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  next();
});

// Express session & passport
app.use(session({
  secret: 'github_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // For HTTPS, you may need secure: true + trust proxy
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files like images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic test route
app.get('/', (req, res) => {
  res.send('Cloud Solution Generator API is running');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/incidents', incidentRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);

// Fallback for 404
app.use((req, res, next) => {
  res.status(404).send({ message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).send({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
