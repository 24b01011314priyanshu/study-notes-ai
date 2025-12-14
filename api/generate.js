// api/generate.js
// Robust Groq AI handler with safe JSON parsing
// Works reliably on Vercel

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  try {
    // Allow only POST
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { topic = "General Topic", mode = "roadmap", mock = false } = req.body;

    // 🧪 MOCK MODE (for testing frontend safely)
    if (mock === true) {
      return res.json({
        ok: true,
        data: {
          roadmap: [
            {
              step: "Introduction",
              subtopics: ["Overview", "Importance"]
            },
            {
              step: "Core Concepts",
              subtopics: ["Concept 1", "Concept 2"]
            }
          ],
          notes: `These are mock notes for ${topic}`,
          quiz: [
            {
              q: `What is ${topic}?`,
              options: ["Option A", "Option B", "Option C", "Option D"],
              answer: 0
            }
          ]
        }
      });
    }

    // ❌ Stop if API key missing
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "GROQ_API_KEY not set in environment variables"
      });
    }

    // 🎯 Prompt based on mode
    let prompt = "";

    if (mode === "roadmap") {
      prompt = `
Create a detailed learning roadmap for "${topic}".

Respond in JSON ONLY in this exact format:
{
  "roadmap": [
    {
      "step": "Topic name",
      "subtopics": ["Subtopic 1", "Subtopic 2"]
    }
  ]
}

IMPORTANT:
- JSON only
- No explanation
- No markdown
`;
    } else if (mode === "notes") {
      prompt = `
Create short, clear study notes for "${topic}".

Respond in JSON ONLY:
{
  "notes": "your notes text here"
}

IMPORTANT:
- JSON only
- No explanation
`;
    } else if (mode === "quiz") {
      prompt = `
Create 5 MCQ questions for "${topic}".

Respond in JSON ONLY:
{
  "quiz": [
    {
      "q": "Question text",
      "options": ["A","B","C","D"],
      "answer": 0
    }
  ]
}

IMPORTANT:
- JSON only
- No explanation
`;
    } else {
      prompt = `
Create a roadmap, notes, and quiz for "${topic}".

Respond in JSON ONLY:
{
  "roadmap": [],
  "notes": "",
  "quiz": []
}

IMPORTANT:
- JSON only
- No explanation
`;
    }

    // 🔗 Call Groq API
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 800
        })
      }
    );

    // 🚨 Read as TEXT (never response.json())
    const rawText = await response.text();

    // Parse Groq envelope safely
    let groqData;
    try {
      groqData = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Groq returned non-JSON response",
        raw: rawText
      });
    }

    const content = groqData?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        ok: false,
        error: "No content returned from Groq",
        raw: groqData
      });
    }

    // ✅ Safe parse AI JSON
    const parsed = safeJSONParse(content);

    if (!parsed) {
      return res.status(500).json({
        ok: false,
        error: "AI returned invalid JSON",
        raw: content
      });
    }

    // 🎉 SUCCESS
    return res.json({
      ok: true,
      data: parsed
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: String(err)
    });
  }
}

