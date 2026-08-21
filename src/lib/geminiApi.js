export const generateAiResponse = async (prompt) => {
  const API_KEY = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

  if (!API_KEY || API_KEY.trim() === '') {
    throw new Error('API ключ Gemini не знайдено. Будь ласка, вкажіть його в налаштуваннях ШІ-асистента.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Помилка API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  try {
    const text = data.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (e) {
    console.error("Помилка парсингу JSON від ШІ:", e, "Сирі дані:", data);
    throw new Error('ШІ повернув дані у невірному форматі (очікувався JSON).');
  }
};
