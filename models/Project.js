// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectCode: {
    type: String,
    required: [true, 'Project code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  projectName: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: [true, 'Contact/Customer is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  estimate: {
    type: Number,
    required: [true, 'Estimate is required'],
    min: [0, 'Estimate cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['In Progress', 'Completed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'In Progress',
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster searches
projectSchema.index({ projectCode: 1 });
projectSchema.index({ contact: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ deadline: 1 });

module.exports = mongoose.model('Project', projectSchema);