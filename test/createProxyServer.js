var http = require('http');

// note this does not start the server, to do so call .listen(port).
module.exports = () =>
  http.createServer((req, res) => {
    // console.debug('Serving:', req.url);
    req.pipe(
      http.request(req.url, req, (remoteRes) => {
        res.writeHead(remoteRes.statusCode, remoteRes.headers);
        remoteRes.pipe(res, { end: true });
      }),
      { end: true }
    );
  });
