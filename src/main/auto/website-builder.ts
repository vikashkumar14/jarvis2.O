import { ipcMain, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { GoogleGenAI } from '@google/genai'

let previewWin: BrowserWindow | null = null

function formatGenAIError(error: any) {
  if (!error) return 'Unknown error from Gemini.'
  if (typeof error === 'string') return error

  if (error.message) {
    try {
      const parsed = JSON.parse(error.message)
      if (parsed?.error?.message) {
        return parsed.error.message
      }
    } catch {
      // ignore parse failure
    }
    return error.message
  }

  if (error.error?.message) return error.error.message
  if (error.statusText) return `${error.statusText} (${error.status})`
  return JSON.stringify(error)
}

export default function registerWebsiteBuilder() {
  ipcMain.handle('build-animated-website', async (event, { prompt, geminiKey }) => {
    if (!event) return
    try {
      previewWin = new BrowserWindow({
        width: 1280,
        height: 720,
        title: 'JARVIS Live Forge :: Web Synthesis',
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      const shellHtml = `
        <html>
          <head>
            <style>
              * { margin:0; padding:0; box-sizing:border-box; }
              html, body { width:100%; height:100%; overflow:hidden; background:#000; font-family:'Courier New', monospace; }

              #matrix-canvas { position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; }

              #scanline {
                position:absolute; top:0; left:0; width:100%; height:3px;
                background:linear-gradient(90deg, transparent, #00ffaa, transparent);
                z-index:11; opacity:0.6; animation: scan 3s linear infinite;
              }
              @keyframes scan { 0% { top:-4px; } 100% { top:100%; } }

              #hud {
                position:absolute; top:0; left:0; width:100%; height:100%; z-index:10;
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                background: radial-gradient(circle at center, rgba(0,20,10,0.25) 0%, rgba(0,0,0,0.88) 80%);
                transition: opacity 0.8s ease;
              }

              #jarvis-title {
                font-size:76px; font-weight:900; letter-spacing:8px; color:#00ffaa;
                text-shadow: 0 0 10px #00ffaa, 0 0 30px #00ffaa, 0 0 60px #00cc88;
                animation: glitch 2.5s infinite, pulse 1.8s ease-in-out infinite;
                text-align:center;
              }
              #jarvis-sub {
                margin-top:12px; font-size:14px; letter-spacing:6px; color:#00ffaa99;
              }

              @keyframes pulse {
                0%,100% { text-shadow:0 0 10px #00ffaa,0 0 30px #00ffaa,0 0 60px #00cc88; }
                50% { text-shadow:0 0 22px #00ffaa,0 0 55px #00ffaa,0 0 95px #00cc88; }
              }
              @keyframes glitch {
                0%,100% { transform: translate(0,0); }
                2% { transform: translate(-3px,2px); }
                4% { transform: translate(3px,-2px); }
                6% { transform: translate(0,0); }
                45% { transform: translate(0,0); }
                47% { transform: translate(2px,-1px); }
                49% { transform: translate(-2px,1px); }
                51% { transform: translate(0,0); }
              }

              #terminal-log {
                margin-top:36px; width:70%; max-width:700px; height:170px; overflow:hidden;
                border:1px solid #00ffaa44; padding:12px; background:rgba(0,20,10,0.45);
                font-size:12px; color:#00ffaa; box-shadow: 0 0 20px #00ffaa22 inset;
              }
              #terminal-log div { opacity:0; animation: fadein 0.4s forwards; white-space:pre-wrap; }
              @keyframes fadein { to { opacity:1; } }
              .cursor {
                display:inline-block; width:8px; height:13px; background:#00ffaa;
                animation: blink 1s step-end infinite; vertical-align:middle; margin-left:2px;
              }
              @keyframes blink { 50% { opacity:0; } }

              #live-frame {
                width:100vw; height:100vh; border:none; position:relative; z-index:2;
                opacity:0; transition: opacity 1s ease;
              }
            </style>
          </head>
          <body>
            <canvas id="matrix-canvas"></canvas>
            <div id="scanline"></div>

            <div id="hud">
              <div id="jarvis-title">J.A.R.V.I.S 2.0</div>
              <div id="jarvis-sub">// LIVE WEB SYNTHESIS ENGINE ONLINE</div>
              <div id="terminal-log"></div>
            </div>

            <iframe id="live-frame"></iframe>

            <script>
              // ---- Matrix rain background ----
              const canvas = document.getElementById('matrix-canvas');
              const ctx = canvas.getContext('2d');
              function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
              resizeCanvas();
              window.addEventListener('resize', resizeCanvas);

              const glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEFJARVIS'.split('');
              const fontSize = 16;
              let columns = Math.floor(canvas.width / fontSize);
              let drops = Array(columns).fill(1);

              function drawMatrix() {
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#00ffaa';
                ctx.font = fontSize + 'px monospace';
                for (let i = 0; i < drops.length; i++) {
                  const char = glyphs[Math.floor(Math.random() * glyphs.length)];
                  ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                  if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                  drops[i]++;
                }
              }
              window.__jarvisMatrixInterval = setInterval(drawMatrix, 45);

              // ---- Fake terminal boot log ----
              const logBox = document.getElementById('terminal-log');
              const bootLines = [
                '> INITIALIZING NEURAL RENDER CORE...',
                '> CONNECTING TO GEMINI SYNTHESIS NODE...',
                '> PARSING USER DIRECTIVE...',
                '> COMPILING TAILWIND MATRIX...',
                '> INJECTING GSAP MOTION LAYERS...',
                '> BUILDING DOM STRUCTURE...',
                '> STREAMING BYTES [OK]'
              ];
              let lineIndex = 0;
              function pushLog(text) {
                const line = document.createElement('div');
                line.innerHTML = text + '<span class="cursor"></span>';
                logBox.appendChild(line);
                while (logBox.children.length > 8) logBox.removeChild(logBox.firstChild);
                logBox.scrollTop = logBox.scrollHeight;
              }
              window.__jarvisLogInterval = setInterval(() => {
                if (lineIndex < bootLines.length) {
                  pushLog(bootLines[lineIndex]);
                  lineIndex++;
                } else {
                  pushLog('> STREAMING DATA... ' + Math.floor(Math.random() * 900 + 100) + ' BYTES/S');
                }
              }, 600);
            </script>
          </body>
        </html>
      `
      await previewWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(shellHtml)}`)

      if (!geminiKey || geminiKey.trim() === '') {
        throw new Error(
          'Missing Gemini API Key. Please configure it in the Command Center Vault (Settings Tab).'
        )
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey })

      const sysPrompt = `You are an elite, Awwwards-winning frontend developer and UI/UX designer. 
Build a highly animated, visually stunning, clean, and premium website based on the user prompt.

CRITICAL RULES:
1. FORMAT: Use a SINGLE HTML file containing all HTML, CSS (in <style>), and JS (in <script>). Start strictly with <!DOCTYPE html>. DO NOT wrap in markdown blockquotes.
2. TECH STACK: 
   - Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
   - GSAP Core & ScrollTrigger: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script> <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
3. REAL IMAGERY ONLY (NO BROKEN LINKS):
   - NEVER invent or hallucinate Unsplash IDs or random URLs. They will break.
   - For ALL background and layout images, you MUST strictly use: "https://picsum.photos/1920/1080?random={number}" (Replace {number} with any digit from 1 to 50).
   - For Avatars, use: "https://i.pravatar.cc/150?img={number}" (Replace {number} with 1 to 50).
   - Use inline <svg> for icons.
4. EYE-CATCHING HERO ELEMENTS & MICRO-INTERACTIONS:
   - Hero Flair: The Hero section MUST include dynamic decorative elements to look premium. Add glowing background orbs (using Tailwind's blur-[100px] and opacity), a slowly rotating circular text stamp (e.g., 'EST 2024 • PREMIUM QUALITY •'), or small floating glassmorphism UI cards overlapping the main image.
   - Magnetic Buttons: Write vanilla JS with GSAP to make the main CTA buttons "magnetic" (the button moves slightly toward the cursor when hovering nearby).
   - Hover States: Add slick, sweeping gradients or scale-up effects (hover:scale-105 transition-transform) to all clickable elements and cards.
5. CONTENT DENSITY & LAYOUT:
   - Generate rich, realistic copy for all sections. NO empty spaces or generic "lorem ipsum" if possible.
   - Use beautiful CSS Grid / Bento-box layouts for Features/Services.
   - Rely heavily on stunning Typography (large fonts, contrasting weights).
6. EXACT THEMING & COLORS:
   - STOP defaulting to Tailwind's 'slate' or 'gray' classes. Use custom arbitrary hex values to match the vibe perfectly.
   - AI/Tech: Pitch black (bg-[#000000]), sleek glass, intense neon accents (text-[#39ff14] or cyan).
   - Cafe/Food: Warm earth tones, deep espresso browns (bg-[#1c140d]), creamy off-whites (text-[#f5ebd7]). NO SLATE GRAYS.
   - Corporate/SaaS: Absolute whites (bg-white), deep navy, trust-building blues.
7. SECTIONS (Must include 5-6 distinct sections):
   - Hero Section: High impact, full-screen. Large GSAP text reveals, the required eye-catching flair (orbs/stamps), and a working background image.
   - About/Mission: Heavy typography focus fading in on scroll.
   - Features/Services: Grid/Bento layout packed with details and hover glows.
   - Showcase/Gallery: Multiple working images in a masonry or horizontal scroll layout.
   - CTA & Footer: High energy, magnetic buttons, large text.

OUTPUT ONLY RAW HTML.`

      const response = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `${sysPrompt}\n\nUSER PROMPT: ${prompt}`
      })

      let fullCode = ''

      for await (const chunk of response) {
        if (chunk.text) {
          fullCode += chunk.text

          let cleanCode = fullCode.replace(/^```html\n?/, '').replace(/```$/, '')

          const safeCode = encodeURIComponent(cleanCode)
          if (previewWin && !previewWin.isDestroyed()) {
            previewWin.webContents
              .executeJavaScript(
                `
              document.getElementById('live-frame').srcdoc = decodeURIComponent('${safeCode.replace(/'/g, "\\'")}');
            `
              )
              .catch(() => {})
          }
        }
      }

      if (previewWin && !previewWin.isDestroyed()) {
        previewWin.webContents
          .executeJavaScript(
            `
          document.getElementById('jarvis-title').innerText = 'J.A.R.V.I.S 2.0 :: ONLINE';
          document.getElementById('jarvis-sub').innerText = '// SYNTHESIS COMPLETE — RENDERING OUTPUT';
          if (window.__jarvisLogInterval) clearInterval(window.__jarvisLogInterval);
          if (window.__jarvisMatrixInterval) clearInterval(window.__jarvisMatrixInterval);
          document.getElementById('live-frame').style.opacity = '1';
          setTimeout(() => {
            const hud = document.getElementById('hud');
            const scan = document.getElementById('scanline');
            if (hud) hud.style.opacity = '0';
            if (scan) scan.style.display = 'none';
            setTimeout(() => { if (hud) hud.style.display = 'none'; }, 900);
          }, 1000);
        `
          )
          .catch(() => {})
      }

      const dirPath = path.join(app.getPath('userData'), 'Websites')
      await fs.mkdir(dirPath, { recursive: true })

      const filePath = path.join(dirPath, `website_${Date.now()}.html`)
      const finalSaveCode = fullCode.replace(/^```html\n?/, '').replace(/```$/, '')
      await fs.writeFile(filePath, finalSaveCode.trim(), 'utf-8')

      return { success: true, filePath }
    } catch (err) {
      const message = formatGenAIError(err)
      const isUnavailable = /UNAVAILABLE|503|high demand|Service Unavailable/i.test(message)
      const suggestion = isUnavailable
        ? 'The Gemini model is currently under high demand. Please try again in a few minutes.'
        : ''
      return { success: false, error: `${message}${suggestion ? ' ' + suggestion : ''}` }
    }
  })
}