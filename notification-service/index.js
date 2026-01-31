const amqp = require("amqplib");
const TASK_CREATED_QUEUE = "task_created";
const NOTIFICATION_SENT_QUEUE = "notification_sent";

async function start() {
  try {
    const connection = await amqp.connect("amqp://rabbitmq");
    const channel = await connection.createChannel();

    await channel.assertQueue(TASK_CREATED_QUEUE, { durable: true });
    await channel.assertQueue(NOTIFICATION_SENT_QUEUE, { durable: true });

    console.log("Notification service listening for tasks events.");

    channel.consume(TASK_CREATED_QUEUE, (msg) => {
      if (!msg)
        try {
          const taskData = JSON.parse(msg.content.toString());

          // Simulate notification logic
          console.log("Notification: NEW TASK");
          console.log("Title:", taskData.title);
          console.log("Payload", taskData);

          // Publish "notification sent" event
          const notificationEvent = {
            taskId: taskData.id,
            title: taskData.title,
            status: "SENT",
            sent_at: new Date().toISOString()
          };

          channel.sendToQueue(
            NOTIFICATION_SENT_QUEUE,
            Buffer.from(JSON.stringify(notificationEvent)),
            { persistent: true }
          );

          console.log("Notification Sent event published");

          channel.ack(msg);
        } catch (err) {
          console.error("Error processing message:", err);
          channel.nack(msg, false, false);
        }
    });
  } catch (err) {
    console.log("RabbitMQ connection error: ", err.message);
    process.exit(1);
  }
}

start();
