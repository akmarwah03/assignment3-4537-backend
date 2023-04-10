const mongoose = require("mongoose");

const ErrorSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Error", ErrorSchema);
