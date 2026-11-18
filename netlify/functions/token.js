const { AccessToken } = require('livekit-server-sdk');

let matchQueue = [];

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, roomName, participantName } = body;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  const missing = [];

  if (!apiKey) missing.push('LIVEKIT_API_KEY');
  if (!apiSecret) missing.push('LIVEKIT_API_SECRET');
  if (!livekitUrl) missing.push('LIVEKIT_URL');

  if (missing.length > 0) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Server not configured', missingVariables: missing }) 
    };
  }

  if (!participantName || typeof participantName !== 'string' || participantName.length > 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid participant name' }) };
  }

  if (action === 'randomMatch') {
    let assignedRoom;
    if (matchQueue.length > 0) {
      assignedRoom = matchQueue.shift();
    } else {
      assignedRoom = `random-${crypto.randomUUID().slice(0, 8)}`;
      matchQueue.push(assignedRoom);
    }
    return { statusCode: 200, headers, body: JSON.stringify({ roomName: assignedRoom }) };
  }

  if (!roomName || typeof roomName !== 'string' || roomName.length > 36) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid room name' }) };
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      ttl: '1h'
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = await at.toJwt();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, url: livekitUrl })
    };
  } catch (err) {
    console.error('Token error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Token generation failed', details: err.message }) };
  }
};
