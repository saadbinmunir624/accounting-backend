// routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Contact = require('../models/Contact'); // THIS IS THE FIX!

// GET all projects (with populated contact)
router.get('/', async (req, res) => {
  try {
    const { status, contact } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (contact) filter.contact = contact;
    
    const projects = await Project.find(filter)
      .populate('contact', 'contactName email phone accountNumber billingAddress')
      .sort({ deadline: 1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('GET projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET single project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('contact', 'contactName email phone accountNumber website billingAddress deliveryAddress');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('GET project by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET project by project code
router.get('/code/:projectCode', async (req, res) => {
  try {
    const project = await Project.findOne({ 
      projectCode: req.params.projectCode.toUpperCase() 
    }).populate('contact', 'contactName email phone accountNumber');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// GET projects by status
router.get('/status/:status', async (req, res) => {
  try {
    const status = req.params.status;
    
    if (!['In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "In Progress" or "Completed"'
      });
    }
    
    const projects = await Project.find({ status })
      .populate('contact', 'contactName email phone accountNumber')
      .sort({ deadline: 1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// POST create new project
router.post('/', async (req, res) => {
  try {
    console.log('\n=== PROJECT CREATION DEBUG ===');
    console.log('1. Request body:', JSON.stringify(req.body, null, 2));
    
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Please send project data.'
      });
    }
    
    const requiredFields = ['projectCode', 'projectName', 'contact', 'deadline', 'estimate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields: missingFields
      });
    }
    
    console.log('2. All required fields present');
    
    console.log('3. Checking if contact exists:', req.body.contact);
    const contactExists = await Contact.findById(req.body.contact);
    
    if (!contactExists) {
      return res.status(400).json({
        success: false,
        message: 'Contact not found',
        contactId: req.body.contact,
        hint: 'Please use GET /api/contacts to get valid contact IDs'
      });
    }
    
    console.log('4. Contact found:', contactExists.contactName);
    
    console.log('5. Creating project...');
    const project = await Project.create(req.body);
    console.log('6. Project created successfully:', project._id);
    
    const populatedProject = await Project.findById(project._id)
      .populate('contact', 'contactName email phone accountNumber');
    
    console.log('7. Project populated and ready to return');
    console.log('=== END DEBUG ===\n');
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: populatedProject
    });
    
  } catch (error) {
    console.error('\n=== PROJECT CREATION ERROR ===');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    console.error('Full Error:', error);
    console.error('=== END ERROR ===\n');
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Project code already exists',
        projectCode: req.body.projectCode
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        field: error.path,
        value: error.value
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
      type: error.name
    });
  }
});

// PATCH update project
router.patch('/:id', async (req, res) => {
  try {
    console.log('Updating project:', req.params.id);
    console.log('Update data:', req.body);
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('contact', 'contactName email phone accountNumber');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    console.error('PATCH project error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Project code already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Bad Request',
      error: error.message
    });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('DELETE project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

module.exports = router;