// api/src/index.js (o un file dedicato)
app.get('/notifications/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.flushHeaders();
  
    // Ogni volta che avviene un update nel Mongo o un event in Bull,
    // puoi emettere un evento SSE. Per esempio, potresti creare un "change stream" su Mongo.
    const changeStream = db.collection('notifications').watch();
    changeStream.on('change', (change) => {
      res.write(`event: update\n`);
      res.write(`data: ${JSON.stringify(change.fullDocument)}\n\n`);
    });
  
    req.on('close', () => {
      changeStream.close();
    });
  });
  