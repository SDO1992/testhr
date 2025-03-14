// dashboard/src/App.jsx (esempio)
import React, { useEffect, useState } from 'react';

function App() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Chiami l’API SSE
    const eventSource = new EventSource('/notifications/stream');
    
    eventSource.addEventListener('update', (e) => {
      const data = JSON.parse(e.data);
      // Aggiorna lo stato front-end in base ai dati ricevuti
      setNotifications(prev => {
        // se la notifica già esiste, sostituisci, altrimenti aggiungi
        const idx = prev.findIndex(n => n._id === data._id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        } else {
          return [data, ...prev];
        }
      });
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      <h1>Dashboard Notifiche</h1>
      <ul>
        {notifications.map(notif => (
          <li key={notif._id}>
            {notif.type} to {notif.recipient} - status: {notif.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
