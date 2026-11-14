
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { prompt, history, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Chave GROQ_API_KEY não configurada na Vercel.'
    });
  }

  try {
    // Busca os modelos disponíveis na conta Groq
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!modelsRes.ok) {
      throw new Error('Não foi possível consultar os modelos da Groq.');
    }

    const modelsData = await modelsRes.json();

    const validModels = (modelsData.data || [])
      .filter(m => m.active !== false)
      .map(m => m.id)
      .filter(id =>
        !id.includes('whisper') &&
        !id.includes('guard') &&
        !id.includes('orpheus') &&
        !id.includes('tts')
      );

    // Prioriza modelos de texto maiores
    const chosenModel =
      validModels.find(id =>
        id.includes('120b') ||
        id.includes('70b') ||
        id.includes('qwen') ||
        id.includes('llama')
      ) || validModels[0];

    if (!chosenModel) {
      throw new Error('Nenhum modelo de texto disponível na Groq.');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: prompt }
    ];

    // Envia a solicitação para o modelo escolhido
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: messages,
        temperature: 0.85,
        max_tokens: 850
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `[Modelo: ${chosenModel}] ` +
          (data.error?.message || 'Erro na Groq')
      });
    }

    const reply = data.choices[0].message.content;

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
