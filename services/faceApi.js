require('dotenv').config();

const FACE_API_BASE = 'https://facial-recognition-backend-wowa.onrender.com'



// These headers go on every request to FaceAPI — they prove who you are
const headers = {
  'Content-Type': 'application/json',
  'X-API-KEY': process.env.FACE_API_KEY,
  'X-API-SECRET': process.env.FACE_API_SECRET,
};


async function enrollFace(imageBase64, identifier) {
  const response = await fetch(FACE_API_BASE + '/api/v1/face/encode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageBase64, identifier }),
  });

  const data = await response.json();

  // If FaceAPI returns an error status, throw it so the route can handle it
  if (!response.ok) {
    throw new Error(data.message || 'Face enrollment failed');
  }

  return data;
}


// Called when TAKING ATTENDANCE
// imageBase64: captured webcam photo as base64
// Returns the matching student's identifier object, or throws if no match
async function recognizeFace(imageBase64) {
  const response = await fetch(FACE_API_BASE + '/api/v1/face/decode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: imageBase64 }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Face not recognized');
  }

  return data; // { identifier: { student_id, name } }
}

module.exports = { enrollFace, recognizeFace };