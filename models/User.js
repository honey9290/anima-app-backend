const mongoose = require("mongoose");

// Define the shape of a user document in MongoDB
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,         // no two users can have the same username
      trim: true,           // strip leading/trailing whitespace
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,       // this will be the HASHED password
    },
    animalName: {
      type: String,
      required: true,       // assigned at registration, never changes
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }      // auto-adds createdAt + updatedAt fields
);

module.exports = mongoose.model("User", userSchema);
