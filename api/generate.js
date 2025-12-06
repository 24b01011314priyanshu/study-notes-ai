export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error: 'Use POST' });

    const { topic = 'data structures', mode = 'quiz', level = 'beginner', qcount = 5, mock = false } = req.body || {};

    // Mock mode (great for local testing)
    if (mock === true || !process.env.GROQ_API_KEY) {
      return res.status(200).json({
        ok: true,
        data: {
          questions: [
            { q: `Mock: What is ${topic}?`, options: ['A','B','C','D'], answer: 0, explanation: 'Mock explanation.' }
          ],
          resources: [
            { title: `Intro to ${topic}`, url: 'https://example.com', type: 'article', short_desc: 'Mock resource.' }
          ]
        },
        mock: true
      });
    }

    // Build prompt (ask the model to return strict JSON)
    const prompt = mode === 'resources'
      ? `Return ${qcount} study resources for "${topic}" for ${level} students as strict JSON: {"resources":[{"title":"...","url":"...","type":"book|video|article|course","short_desc":"..."}]}`
      : `Return ${qcount} multiple-choice questions about "${topic}" for ${level} students as strict JSON: {"questions":[{"q":"...","options":["...","...","...","..."],"answer":<0-based index>,"explanation":"..."}]}`;

    // Call Groq Chat/LLM endpoint (example). Replace endpoint/model if your provider differs.
    const providerResp = await fetch('https://api.groq.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8k', // choose an available Groq model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 600
      })
    });

    if (!providerResp.ok) {
      const txt = await providerResp.text();
      return res.status(502).json({ ok:false, error: 'Provider error', details: txt });
    }

    const payload = await providerResp.json();
    const content = payload.choices?.[0]?.message?.content ?? '';

    // Extract JSON block from model response
    const match = content.match(/(\{[\s\S]*\})/);
    const rawJson = match ? match[1] : content;
    let parsed;
    try { parsed = JSON.parse(rawJson); } catch (e) { parsed = null; }

    if (!parsed) {
      // If parsing failed, return raw content to help debugging
      return res.status(500).json({ ok:false, error: 'Failed to parse model JSON', raw: content });
    }

    // Limit arrays to qcount
    if (parsed.questions) parsed.questions = parsed.questions.slice(0, qcount);
    if (parsed.resources) parsed.resources = parsed.resources.slice(0, qcount);

    return res.status(200).json({ ok:true, data: parsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
}