// processor/src/worker.js
const Bull = require('bull');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const CircuitBreaker = require('opossum'); // libreria circuit-breaker, ad esempio
// Oppure un proprio wrapper di retry/backoff

// Config coda
const notificationQueue = new Bull('notifications_queue', {
  redis: {
    host: 'redis',
    port: 6379
  }
});

// Connessione Mongo
let db;
MongoClient.connect(process.env.MONGO_URL || 'mongodb://mongo:27017/notifications')
  .then(client => {
    db = client.db();
    console.log('Connected to Mongo from worker');
  })
  .catch(err => console.error('Mongo Connection Error:', err));

// Configurazione circuit breaker
const breakerOptions = {
  timeout: 3000, // tempo massimo per la richiesta
  errorThresholdPercentage: 50, // quando >= 50% delle richieste falliscono, si apre il circuito
  resetTimeout: 10000 // tempo dopo cui il circuito tenta di richiudersi
};
const circuitBreakerAction = (jobData) => {
  // Qui dentro effettui la chiamata all’API esterna con axios
  return axios.post(`http://mock-api:4000/send`, {
    type: jobData.type,
    recipient: jobData.recipient,
    message: jobData.message
  }, {
    timeout: 5000 // 5 secondi, in linea con possibili timeouts
  });
};
const breaker = new CircuitBreaker(circuitBreakerAction, breakerOptions);

// Handler del job
notificationQueue.process(async (job) => {
  const { _id, type, recipient, message } = job.data;

  try {
    // Chiamata tramite circuit breaker
    const response = await breaker.fire({ type, recipient, message });

    // Se arrivi qui, significa che la chiamata è andata a buon fine
    await db.collection('notifications').updateOne(
      { _id: ObjectId(_id) },
      { $set: { status: 'sent', sentAt: new Date() } }
    );
    return Promise.resolve();
  } catch (err) {
    console.error('Errore in invio notifica:', err);

    // Aggiorni lo stato come 'failed' (oppure gestisci i retry nativi di Bull)
    await db.collection('notifications').updateOne(
      { _id: ObjectId(_id) },
      { $set: { status: 'failed', error: err.message } }
    );

    // Rilanciamo l’errore per consentire a Bull di attivare meccanismi di retry
    return Promise.reject(err);
  }
});

// Opzionalmente, gestisci eventi di completamento/fallimento per aggiornare la Dashboard
notificationQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully.`);
  // notifica la dashboard via WS/SSE
});

notificationQueue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed: ${err.message}`);
  // notifica la dashboard via WS/SSE
});
