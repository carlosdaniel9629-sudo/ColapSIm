
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido'
    });
  }

  const { prompt, history, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Chave GROQ_API_KEY não configurada na Vercel.'
    });
  }

  try {
    // Consulta os modelos disponíveis na conta Groq
    const modelsRes = await fetch(
      'https://api.groq.com/openai/v1/models',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!modelsRes.ok) {
      const errorData = await modelsRes.json();

      throw new Error(
        errorData.error?.message ||
        'Falha ao consultar os modelos da Groq.'
      );
    }

    const modelsData = await modelsRes.json();

    // Filtra modelos ativos de texto
    const validModels = (modelsData.data || [])
      .filter(m => m.active !== false)
      .map(m => m.id)
      .filter(id =>
        !id.includes('whisper') &&
        !id.includes('guard') &&
        !id.includes('orpheus') &&
        !id.includes('tts')
      );

    // Modelos preferenciais em ordem de prioridade
    const preferredModels = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b'
    ];

    // Escolhe o primeiro modelo disponível
    const chosenModel = preferredModels.find(
      id => validModels.includes(id)
    );

    if (!chosenModel) {
      throw new Error(
        'Nenhum dos modelos preferenciais está disponível. Modelos encontrados: ' +
        validModels.join(', ')
      );
    }

    // Monta o histórico da conversa
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...(history || []),
      {
        role: 'user',
        content: prompt
      }
    ];

    // Envia a solicitação para a API de chat
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
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
      }
    );

    const data = await response.json();

    // Verifica erros da API
    if (!response.ok) {
      return res.status(response.status).json({
        error: `[Modelo: ${chosenModel}] ` +
          (data.error?.message || 'Erro na Groq')
      });
    }

    // Extrai a resposta gerada
    const reply = data.choices[0].message.content;

    return res.status(200).json({
      reply,
      model: chosenModel
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
