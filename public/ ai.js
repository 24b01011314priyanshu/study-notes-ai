// public/ai.js - frontend AI helpers and UI functions

async function aiRequest(payload) {
  // send to /api/generate
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return { ok:false, error: err.message };
  }
}

/* ROADMAP: build checklist from AI roadmap JSON */
function saveRoadmapProgress(topicKey, state) {
  localStorage.setItem(`roadmap-progress-${topicKey}`, JSON.stringify(state));
}
function loadRoadmapProgress(topicKey) {
  const raw = localStorage.getItem(`roadmap-progress-${topicKey}`);
  return raw ? JSON.parse(raw) : {};
}

function renderRoadmap(topic, roadmap) {
  const out = document.getElementById("roadmap-output");
  out.innerHTML = "";
  const key = topic.toLowerCase().replace(/\s+/g,"-");
  const state = loadRoadmapProgress(key);

  // progress counters
  let totalSub = 0, doneSub = 0;
  roadmap.forEach((r, idx) => {
    const item = document.createElement("div");
    item.className = "item card";
    const id = `topic-${idx}`;
    // top row
    const titleRow = document.createElement("div");
    titleRow.style.display="flex"; titleRow.style.justifyContent="space-between"; titleRow.style.alignItems="center";
    const left = document.createElement("div");
    const chk = document.createElement("input");
    chk.type="checkbox"; chk.className="checkbox";
    chk.checked = !!(state[r.step] && state[r.step].checked);
    chk.onchange = () => {
      state[r.step] = state[r.step] || { checked:false, sub: {} };
      state[r.step].checked = chk.checked;
      // if checking topic, mark all subtopics as checked too
      if (chk.checked) {
        (r.subtopics||[]).forEach(s => { state[r.step].sub[s]=true; });
      }
      saveRoadmapProgress(key, state);
      renderRoadmap(topic, roadmap);
    };
    left.appendChild(chk);
    const h = document.createElement("strong"); h.textContent = r.step;
    left.appendChild(h);
    titleRow.appendChild(left);

    const right = document.createElement("div");
    const expBtn = document.createElement("button"); expBtn.className="btn small";
    expBtn.textContent = (state[r.step] && state[r.step].expanded) ? "Collapse" : "Expand";
    expBtn.onclick = () => { state[r.step]=state[r.step]||{checked:false,sub:{}}; state[r.step].expanded = !state[r.step].expanded; saveRoadmapProgress(key, state); renderRoadmap(topic, roadmap); };
    right.appendChild(expBtn);
    titleRow.appendChild(right);

    item.appendChild(titleRow);

    if (state[r.step] && state[r.step].expanded) {
      // subtopics list
      (r.subtopics || []).forEach(sub => {
        totalSub++;
        const sdiv = document.createElement("div");
        sdiv.className = "subtopic";
        const sChk = document.createElement("input"); sChk.type="checkbox"; sChk.className="checkbox";
        sChk.checked = !!(state[r.step] && state[r.step].sub && state[r.step].sub[sub]);
        if (sChk.checked) doneSub++;
        sChk.onchange = () => {
          state[r.step]=state[r.step]||{checked:false,sub:{}};
          state[r.step].sub[sub] = sChk.checked;
          // if all subtopics checked, also check the main topic
          const all = (r.subtopics||[]).every(s => state[r.step].sub[s]);
          state[r.step].checked = all;
          saveRoadmapProgress(key, state);
          renderRoadmap(topic, roadmap);
        };
        sdiv.appendChild(sChk);
        const span = document.createElement("span"); span.textContent = sub;
        sdiv.appendChild(span);
        item.appendChild(sdiv);
      });
    } else {
      // show short subtopic count preview
      const preview = document.createElement("div"); preview.className="small";
      preview.textContent = `${(r.subtopics||[]).length} subtopics • Click Expand to view`;
      item.appendChild(preview);
      totalSub += (r.subtopics||[]).length;
      // count done subtopics if present
      if (state[r.step] && state[r.step].sub) {
        doneSub += Object.values(state[r.step].sub).filter(v=>v===true).length;
      }
    }

    out.appendChild(item);
  });

  // progress bar
  const progressWrap = document.getElementById("roadmap-progress-wrap");
  if(progressWrap){
    const pct = totalSub ? Math.round((doneSub/totalSub)*100) : 0;
    progressWrap.querySelector(".small").textContent = `Completed ${doneSub} / ${totalSub} (${pct}%)`;
    progressWrap.querySelector(".progress > i").style.width = pct + "%";
  }
}

/* Generic helper to call AI and handle errors */
async function generateAndRender(mode, topic, opts={}) {
  const status = document.getElementById("ai-status");
  const output = document.getElementById("ai-output");
  if (status) status.textContent = "Generating..."; if (output) output.innerHTML = "";
const payload = { topic, mode, qcount: opts.qcount || 6, mock: true }
const json = await aiRequest(payload);
  if (!json.ok) {
    if (status) status.textContent = "Error: "+(json.error||"unknown");
    return json;
  }
  if (status) status.textContent = "Done";
  return json.data;
}

