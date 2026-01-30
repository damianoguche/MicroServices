const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const { logger } = require("./utils/logger");
const { auth } = require("./utils/auth");
const amqp = require("amqplib");

const app = express();
const PORT = 3002;

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
//   .connect("mongodb://localhost:27017/tasks")
//   .then(() => logger.info("Connected to database"))
//   .catch((err) => logger.error("Database connection error: ", err));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to database"))
  .catch((err) => logger.error("Database connection error: ", err));

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const Task = mongoose.model("Task", TaskSchema);

let connection, channel;
const queue = "task_created";

async function connectRabbitMQWithRetry(retries = 5, delay = 3000) {
  while (retries) {
    try {
      connection = await amqp.connect("amqp://rabbitmq");
      channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      console.log("Connected to RabbitMQ");
      return;
    } catch (err) {
      console.error("RabbitMQ connection error: ", err.message);
      retries--;
      console.error("Retrying again: ", retries);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

/**
 * Create a new task
 *
 * @route POST /tasks
 * @param {string} title - Task name
 * @param {string} description - Tsk description
 * @returns {object} 201 - Created task object
 * @returns {Error} 400 - Task creation error
 */
app.post("/tasks", auth, async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.id;

  try {
    const task = new Task({
      title,
      description,
      userId
    });

    await task.save();

    const message = {
      taskId: task._id,
      userId,
      title
    };

    if (!channel)
      return res.status(503).json({ error: "RabbitMQ not connected" });

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });

    logger.info("Task Created", { taskId: task._id, userId });

    res.status(201).json(task);
  } catch (err) {
    logger.error("Error creating task", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Retrieve all tasks
 *
 * @route GET /tasks
 * @returns {object} 200 - Retrieved task object
 * @returns {Error} 500 - Task retrieval error
 */
app.get("/tasks", auth, async (req, res) => {
  try {
    const tasks = await Task.find({
      userId: req.user.id
    });

    res.status(200).json(tasks);
  } catch (err) {
    logger.error("Error fetching users", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Global error handling
 */
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  logger.info(`Task service running on port ${PORT}`);
  connectRabbitMQWithRetry();
});
