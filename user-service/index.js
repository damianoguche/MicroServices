require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const { logger } = require("./utils/logger");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Log every request
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.originalUrl
  });
  next();
});

// mongoose
//   .connect("mongodb://localhost:27017/users")
//   .then(() => logger.info("Connected to database"))
//   .catch((err) => logger.error("Database connection error: ", err));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to database"))
  .catch((err) => logger.error("Database connection error: ", err));

const UserSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    select: false
  }
});

const User = mongoose.model("User", UserSchema);

/**
 * Create a new user
 *
 * @route POST /users
 * @param {string} name - User name
 * @param {string} email - User email addrzess
 * @param {string} password - User password
 * @returns {object} 201 - Created user object
 * @returns {Error} 400 - Validation error
 */
app.post("/users", async (req, res) => {
  const { name, email, password } = req.body;
  const SALT_ROUNDS = 10;

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    logger.info("User created", { userId: user._id });
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    logger.error("Error creating users", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Login a user
 *
 * @route POST /login
 * @param {string} email - User email addrzess
 * @param {string} password - User password
 * @returns {object} 200 - Token object
 * @returns {Error} 500 - Login error
 */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h"
    });
    logger.info("Login Successful!");
    res.json({ token });
  } catch (err) {
    logger.error("Login error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Retrieve users
 *
 * @route GET /users
 * @returns {object} 200 - Retrieved user object
 * @returns {Error} 500 - User fetching error
 */
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("_id name email");
    res.status(200).json(users);
  } catch (err) {
    logger.error("Error fetching users", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  logger.info(`User service running on port ${PORT}`);
});
