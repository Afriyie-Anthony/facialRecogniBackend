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


// Called when DELETING A STUDENT
// Permanently removes the face template from the model workspace using the
// template_id that was returned when the student was originally enrolled.
// Endpoint: DELETE /api/v1/face/templates/<template_id>
async function deleteFace(templateId) {
  const response = await fetch(`${FACE_API_BASE}/api/v1/face/templates/${templateId}`, {
    method: 'DELETE',
    headers,
  });

  // 404 means the template was already removed or never saved — not an error
  if (response.status === 404) {
    console.warn(`deleteFace: template "${templateId}" not found in model — already removed?`);
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    console.error('FaceAPI Delete Error:', data);
    throw new Error(data.message || 'Face deletion failed');
  }

  return data;
}

module.exports = { enrollFace, recognizeFace, deleteFace };