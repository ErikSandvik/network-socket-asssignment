const net = require('net');
const crypto = require('crypto');

// Map to keep track of each client's connection state and handshake status
const clients = new Map();

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

const wsServer = net.createServer((connection) => {
    console.log('Client connected');

    clients.set(connection, {handshakeCompleted: false});

    connection.on('data', (data) => {
        if (!clients.get(connection).handshakeCompleted) {
            const headers = data.toString();
            if (headers.match(/Upgrade: websocket/i) && headers.match(/Connection: Upgrade/i)) {
                const key = (headers.match(/Sec-WebSocket-Key: (.+)/) || [null, null])[1].trim();
                const guid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
                const accept = crypto.createHash('sha1').update(key + guid).digest('base64');
                const response = [
                    "HTTP/1.1 101 Switching Protocols",
                    "Upgrade: websocket",
                    "Connection: Upgrade",
                    `Sec-WebSocket-Accept: ${accept}`,
                    "\r\n"
                ].join("\r\n");
                connection.write(response);
                clients.get(connection).handshakeCompleted = true;
            }
        } else {
            const message = parseFrame(data);
            broadcastMessage('Broadcast: ' + message);
            console.log('Message received:', message);
        }
    });

    connection.on('end', () => {
        console.log('Client disconnected');
        // Remove the client from the map
        clients.delete(connection);
    });

    connection.on('error', (error) => {
        console.error('Error: ', error);
        clients.delete(connection);
    });
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

    if (masked) {
        maskingKey = buffer.slice(currentOffset, currentOffset + 4);
        currentOffset += 4;
        payload = buffer.slice(currentOffset, currentOffset + payloadLength);
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskingKey[i % 4];
        }
    }

    return payload.toString();
}

function sendTextMessage(connection, message) {
    const buffer = Buffer.from(message, 'utf8');
    const length = buffer.length;
    let frame = Buffer.alloc(2 + length);

    frame[0] = 0x81; // Text frame opcode
    frame[1] = length; // Payload length

    buffer.copy(frame, 2); // Copy the message payload into the frame
    connection.write(frame);
}

function broadcastMessage(message) {
    clients.forEach((value, key) => {
        if (value.handshakeCompleted) {
            sendTextMessage(key, message);
        }
    });
}
``
