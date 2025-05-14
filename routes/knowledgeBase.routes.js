const express = require('express');
const router = express.Router();
const KnowledgeBase = require('../models/KnowledgeBase');
const { protect, authorize } = require('../middleware/auth');

// Get all knowledge base articles
router.get('/', async (req, res) => {
  try {
    let query;
    
    // Copy req.query
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    
    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Finding resource
    query = KnowledgeBase.find(JSON.parse(queryStr));
    
    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
    
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-updatedAt');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await KnowledgeBase.countDocuments(JSON.parse(queryStr));
    
    query = query.skip(startIndex).limit(limit);
    
    // Executing query
    const articles = await query;
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: articles.length,
      pagination,
      data: articles
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get single knowledge base article
router.get('/:id', async (req, res) => {
  try {
    const article = await KnowledgeBase.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    
    res.status(200).json({
      success: true,
      data: article
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Create new knowledge base article
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const article = await KnowledgeBase.create(req.body);
    
    res.status(201).json({
      success: true,
      data: article
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update knowledge base article
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    // Update timestamp
    req.body.updatedAt = Date.now();
    
    const article = await KnowledgeBase.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    
    res.status(200).json({
      success: true,
      data: article
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete knowledge base article
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const article = await KnowledgeBase.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    
    await article.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;