const net = require('net');
const crypto = require('crypto');

// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer((connection) => {
    connection.on('data', () => {
        let content = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>WebSocket Test Page</title>
  </head>
  <body>
    <h2>WebSocket Test Page</h2>
    <input id="messageInput" type="text" placeholder="Write message here..." />
    <button id="sendButton">Send</button>
    <script>
      const ws = new WebSocket('ws://localhost:3001');
      ws.onmessage = event => {
        alert('Message from server: ' + event.data);
      };
      ws.onopen = () => {
        console.log('WebSocket connection established');
      };
      document.getElementById('sendButton').onclick = () => {
        const message = document.getElementById('messageInput').value;
        ws.send(message);
        console.log('Message sent:', message);
      };
    </script>
  </body>
</html>
`;
        connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
    });
});
httpServer.listen(3000, () => {
    console.log('HTTP server listening on port 3000');
});


// Incomplete WebSocket server
const wsServer = net.createServer((connection) => {
    let handshakeIsDone = false;
    console.log('Client connected');

    connection.on('data', (data) => {
        if (!handshakeIsDone) {
            const headers = data.toString();
            console.log('Headers: ', headers);
            // Checks if there has been a handshake request already or not
            if (headers.match(/Upgrade: websocket/i) && headers.match(/Connection: Upgrade/i)) {
                //handles handshake

                const key = (headers.match(/Sec-WebSocket-Key: (.+)/) || [null, null])[1].trim();
                const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
                let combined = key + guid;
                const accept = crypto.createHash('sha1').update(combined).digest('base64');
                const response = "HTTP/1.1 101 Switching Protocols\r\n" + "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";

                connection.write(response);

                console.log("Handshake executed")
                handshakeIsDone = true;
            }
        } else {
            //handling socket frames
            const message = parseFrame(data);
            console.log('Received:', message);

            sendTextMessage(connection, 'Echo: ' + message);
        }
    });

    connection.on('end', () => {

        console.log('Client disconnected');
    });

});

wsServer.on('error', (error) => {
    console.error('Error: ', error);
});
wsServer.listen(3001, () => {
    console.log('WebSocket server listening on port 3001');
});



function parseFrame(buffer) {
    const fin = buffer[0] & 0x80;
    const opcode = buffer[0] & 0x0F;
    const masked = buffer[1] & 0x80;
    const payloadLength = buffer[1] & 0x7F;
    let currentOffset = 2;
    let maskingKey;
    let payload;

    if(masked) {
        maskingKey = buffer.slice(currentOffset, currentOffset + 4);
        currentOffset += 4;
        payload = buffer.slice(currentOffset, currentOffset + payloadLength);
        for(let i = 0; i < payload.length; i++) {
            payload[i] ^= maskingKey[i % 4];
        }
    }

    return payload.toString();
}

function sendTextMessage(connection, message) {
    const buffer = Buffer.from(message, 'utf8');
    const length = buffer.length;
    let frame = Buffer.alloc(2 + length);

    frame[0] = 0x81;
    frame[1] = length;

    buffer.copy(frame, 2);
    connection.write(frame);
}