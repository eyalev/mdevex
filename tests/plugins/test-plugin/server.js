export default function({ app, wss, eventBus }) {
  app.get('/api/test-plugin/ping', (req, res) => {
    res.json({ pong: true });
  });

  let wsCount = 0;
  eventBus.on('ws-connect', () => { wsCount++; });
  eventBus.on('ws-disconnect', () => { wsCount--; });

  app.get('/api/test-plugin/connections', (req, res) => {
    res.json({ count: wsCount });
  });
}
