const amqp = require("amqplib");
const queue = "task_created";

async function start() {
  try {
    const connection = await amqp.connect("amqp://rabbitmq");
    const channel = await connection.createChannel();

    await channel.assertQueue(queue, { durable: true });
    console.log("Notification service is listening to messages.");

    channel.consume(queue, (msg) => {
      const taskData = JSON.parse(msg.content.toString());
      console.log("Notification: NEW TASK: ", taskData.title);
      console.log("Notification: NEW TASK: ", taskData);
      channel.ack(msg);
    });
  } catch (err) {
    console.log("RabbitMQ connection error: ", error.message);
  }
}

start();
