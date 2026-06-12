require('dotenv').config();

const FACE_API_BASE = 'https://facial-recognition-backend-wowa.onrender.com'



// These headers go on every request to FaceAPI — they prove who you are
const headers = {
  'Content-Type': 'application/json',
  'X-API-KEY': process.env.FACE_API_KEY,
  'X-API-SECRET': process.env.FACE_API_SECRET,
};


async function enrollFace(imageBase64, identifier) {
  // Strip data:image/...;base64, prefix if it exists
  const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(FACE_API_BASE + '/api/v1/face/encode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: cleanImage, identifier }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('FaceAPI Enroll Error:', data);
    throw new Error(data.message || 'Face enrollment failed');
  }

  return data;
}


// Called when TAKING ATTENDANCE
// imageBase64: captured webcam photo as base64
// Returns the matching student's identifier object, or throws if no match
async function recognizeFace(imageBase64) {
  // Strip data:image/...;base64, prefix if it exists
  const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(FACE_API_BASE + '/api/v1/face/decode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: cleanImage }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('FaceAPI Recognize Error:', data);
    throw new Error(data.message || 'Face not recognized');
  }

  return data; // { identifier: { student_id, name } }
}

module.exports = { enrollFace, recognizeFace };