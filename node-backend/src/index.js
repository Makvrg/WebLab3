import http from 'node:http';

const PORT = process.env.PORT || 4000
const server = http.createServer((req, res) => {
   res.writeHead(200, {"Content-Type": "application/json"});
   res.end(JSON.stringify({status: "ok", url: req.url}));
});

server.listen(PORT, () => {
   console.log(`node-backend stub ready and listening on ${PORT}`)
});
