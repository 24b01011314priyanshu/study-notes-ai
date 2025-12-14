// api/generate.js
// Vercel/Netlify-style serverless function using GROQ (free)
// It supports modes: 'roadmap' | 'notes' | 'quiz' | 'resources' | 'chat'
// Use mock: true in body to test UI without API key.

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Use POST" });

    const { topic = "web development", mode = "roadmap", qcount = 5, mock = false, message = "" } = req.body || {};

    // Mock response (useful for testing without key)
    if (mock === true || !process.env.GROQ_API_KEY) {
      const mockData = {
        roadmap: [
          { step: "Introduction", subtopics: ["Overview", "Why learn this"] },
          { step: "Basics", subtopics: ["Syntax", "Core Concepts"] },
          { step: "Advanced", subtopics: ["Optimization", "Best Practices"] }
        ],
        notes: `## ${topic}\n\nThis is a short mock note about ${topic}. Add more details later.`,
        quiz: [
          { q: `Mock: What is ${topic}?`, options: ["A","B","C","D"], answer: 1, explanation: "Mock explanation."}
        ],
        resources: [
          { title: `Intro to ${topic}`, url: "https://www.example.com", type:"article", short_desc:"Mock resource" }
        ],
        chat: { reply: `Mock reply for: ${message}` }
      };
      return res.status(200).json({ ok:true, mock:true, data: mockData });
    }

    // Build prompts per mode - instruct strict JSON output
    let prompt = "";
    if (mode === "roadmap") {
      prompt = `You are an expert teacher. For the topic "${topic}" produce a study roadmap with 6-12 steps. Return strict JSON: {"roadmap":[{"step":"...","subtopics":["...","..."]}, ...]}`;
    } else if (mode === "notes") {
      prompt = `You are a concise note generator. For topic "${topic}" produce well-structured study notes with headings and bullet points. Return JSON: {"notes":"<markdown or plain text>"} (notes must be a single string).`;
    } else if (mode === "quiz") {
      prompt = `Create ${qcount} multiple choice questions for "${topic}". Return JSON: {"quiz":[{"q":"...","options":["...","...","...","..."],"answer":<0-based index>,"explanation":"..."}]}`;
    } else if (mode === "resources") {
      prompt = `Provide ${qcount} high-quality study resources for "${topic}". Return JSON: {"resources":[{"title":"...","url":"...","type":"video|article|book|course","short_desc":"..."}]}`;
    } else if (mode === "chat") {
      prompt = `You are a helpful tutor. Answer the student's question concisely. Student: "${message}". Return JSON: {"reply":"..."} `;
    } else {
      prompt = `For topic "${topic}" return JSON with keys roadmap, notes, quiz, resources. Keep concise.`;
    }

    // Call GROQ - endpoint (compatible OpenAI path)
    const providerResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.15,
        max_tokens: 900
      })
    });

    if (!providerResp.ok) {
      const txt = await providerResp.text();
      return res.status(502).json({ ok:false, error:"Provider error", details: txt });
    }

    const payload = await providerResp.json();
    const content = payload.choices?.[0]?.message?.content ?? "";

    // Extract JSON block
    const match = content.match(/(\{[\s\S]*\})/);
    const rawJson = match ? match[1] : content;

    let parsed;
    try { parsed = JSON.parse(rawJson); }
    catch (e) {
      // If parse fails, return raw for debugging
      return res.status(500).json({ ok:false, error:"Failed to parse model output as JSON", raw: content });
    }

    return res.status(200).json({ ok:true, data: parsed });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
}

