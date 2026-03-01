// Check if username is available
export async function checkUsernameAvailability(username: string) {
  const res = await fetch(`http://localhost:3001/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

// Upload profile image to Supabase Storage
export async function uploadProfileImage(file: File, userId: string, token: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  
  const res = await fetch('http://localhost:3001/api/user/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData
  });
  return res.json();
}

// Check if username is available
// API helpers for registration and login
export async function registerUser({ name, username, email, phone, password, date_of_birth, gender }) {
  const res = await fetch('http://localhost:3001/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
      username,
      phone,
      photo: '',
      interests: '',
      date_of_birth,
      gender
    })
  });
  return res.json();
}

export async function loginUser({ email, password }) {
  const res = await fetch('http://localhost:3001/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

export async function editProfile({ name, username, photo, interests, date_of_birth, gender, token }) {
  const res = await fetch('http://localhost:3001/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name, username, photo, interests, date_of_birth, gender })
  });
  return res.json();
}
