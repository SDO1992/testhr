const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');
// Libreria di validazione, ad esempio Joi
const Joi = require('joi');

const app = express();
app.use(bodyParser.json());

// Config Redis
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
redisClient.connect();

// Config MongoDB
let db;
MongoClient.connect(process.env.MONGO_URL || 'mongodb://mongo:27017/notifications')
  .then(client => {
    db = client.db();
  })
  .catch(err => console.error('Mongo Connection Error:', err));

// Schema di validazione
const notificationSchema = Joi.object({
  type: Joi.string().valid('email', 'sms').required(),
  recipient: Joi.string().required(),
  message: Joi.string().required()
});

// Endpoint per ricevere la richiesta di notifica
app.post('/notifications', async (req, res) => {
  try {
    const { error, value } = notificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Salvataggio iniziale su Mongo (stato "queued")
    const notification = {
      ...value,
      status: 'queued',
      createdAt: new Date()
    };
    const result = await db.collection('notifications').insertOne(notification);
    const notificationId = result.insertedId.toString();

    // Inserimento in coda Redis (puoi usare Bull, BullMQ o raw Redis)
    // Qui usiamo un semplice push in una lista
    await redisClient.lPush('notifications_queue', JSON.stringify({
      _id: notificationId,
      ...value
    }));

    return res.status(201).json({
      message: 'Notifica ricevuta e messa in coda',
      notificationId
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Notification Collector listening on port ${PORT}`);
});
