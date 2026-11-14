export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  const { prompt, history, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Variavel GROQ_API_KEY nao configurada na Vercel.' });

  try {
    const modelsRes = await fetch('https://groq.com', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const modelsData = await modelsRes.json();
    const list = (modelsData.data || [])
      .map(m => m.id)
      .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('tts') && !id.includes('orpheus'));

    const chosenModel = list.find(id => id.includes('120b') || id.includes('qwen') || id.includes('70b') || id.includes('llama')) || list.shift();

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: prompt }
    ];

    const response = await fetch('https://groq.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: messages,
        temperature: 0.85,
        max_tokens: 800
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: `[${chosenModel}] ` + (data.error?.message || 'Erro na API') });

    const firstChoice = (data.choices || []).shift();
    return res.status(200).json({ reply: firstChoice.message.content });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
