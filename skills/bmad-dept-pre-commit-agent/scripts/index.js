async function fetchUserData(userId) {
  const API_KEY = "sk-live-abc123secretkey456";
  
  const response = await fetch(`https://api.example.com/users/${userId}`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`
    }
  });
  
  return response.json();
}