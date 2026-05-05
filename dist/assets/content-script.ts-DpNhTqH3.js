(function(){const v=new Set(["jpg","jpeg","png","gif","webp","bmp","svg","tiff","tif","ico","avif","heic","heif"]);chrome.runtime.onMessage.addListener((r,t,i)=>{var e;if(r.type==="GET_IMAGE_DATA"){const s=(e=r.payload)==null?void 0:e.imageUrl;if(!s){i({error:"No image URL provided"});return}return z(s).then(a=>i({dataUrl:a})).catch(a=>i({error:a.message})),!0}});async function z(r){return new Promise((t,i)=>{const e=new Image;r.startsWith("file:")||(e.crossOrigin="anonymous"),e.onload=()=>{try{const s=document.createElement("canvas");s.width=e.naturalWidth,s.height=e.naturalHeight;const a=s.getContext("2d");if(!a){i(new Error("Failed to get canvas context"));return}a.drawImage(e,0,0);const n=s.toDataURL("image/png");t(n)}catch{f(r).then(t).catch(i)}},e.onerror=()=>{f(r).then(t).catch(i)},e.src=r})}async function f(r){const t=await fetch(r);if(!t.ok)throw new Error(`Failed to fetch image: ${t.status}`);const i=await t.blob();return new Promise((e,s)=>{const a=new FileReader;a.onload=()=>e(a.result),a.onerror=()=>s(new Error("Failed to read image blob")),a.readAsDataURL(i)})}function k(){return location.protocol==="file:"}function E(){if(document.title.startsWith("Index of"))return!0;const t=document.querySelectorAll("a[href]");let i=0;return t.forEach(e=>{var n;const a=((n=(e.getAttribute("href")||"").split(".").pop())==null?void 0:n.toLowerCase().split("?")[0])||"";v.has(a)&&i++}),i>=2}function L(){const r=[],t=new Set;return document.querySelectorAll("a[href]").forEach(e=>{var p;const s=e.getAttribute("href")||"",a=((p=s.split(".").pop())==null?void 0:p.toLowerCase().split("?")[0])||"";if(!v.has(a))return;let n;try{n=new URL(s,location.href).href}catch{return}t.has(n)||(t.add(n),r.push(n))}),r}function S(){const r=location.href;try{return decodeURIComponent(r.replace("file:///","").replace(/\/$/,""))}catch{return r}}function I(r){if(document.getElementById("imgsearch-panel"))return;const t=S(),i=r.length,e=document.createElement("div");e.id="imgsearch-panel",e.innerHTML=`
    <style>
      #imgsearch-panel {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #e8eaf0;
        pointer-events: auto;
      }
      #imgsearch-panel * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .imgsearch-card {
        background: linear-gradient(135deg, #1c1f2e 0%, #252839 100%);
        border: 1px solid rgba(129, 140, 248, 0.25);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(99, 102, 241, 0.1);
        backdrop-filter: blur(20px);
        width: 340px;
        overflow: hidden;
        transition: all 0.3s ease;
        animation: imgsearch-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .imgsearch-card:hover {
        box-shadow: 0 24px 48px rgba(0,0,0,0.5), 0 0 40px rgba(99, 102, 241, 0.15);
        border-color: rgba(129, 140, 248, 0.4);
      }
      @keyframes imgsearch-slideIn {
        from { transform: translateY(20px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      .imgsearch-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(129, 140, 248, 0.12);
        background: rgba(99, 102, 241, 0.06);
      }
      .imgsearch-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .imgsearch-logo {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
      }
      .imgsearch-title {
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #818cf8, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .imgsearch-close {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #6b7094;
        font-size: 14px;
        transition: all 0.15s;
        border: none;
        background: none;
      }
      .imgsearch-close:hover {
        background: rgba(255,255,255,0.08);
        color: #e8eaf0;
      }
      .imgsearch-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .imgsearch-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(99, 102, 241, 0.08);
        border-radius: 10px;
        border: 1px solid rgba(99, 102, 241, 0.12);
      }
      .imgsearch-stats-icon {
        font-size: 22px;
      }
      .imgsearch-stats-info {
        flex: 1;
      }
      .imgsearch-stats-count {
        font-size: 18px;
        font-weight: 700;
        color: #818cf8;
      }
      .imgsearch-stats-label {
        font-size: 11px;
        color: #6b7094;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .imgsearch-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-family: inherit;
        width: 100%;
      }
      .imgsearch-btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      .imgsearch-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      }
      .imgsearch-btn-primary:active {
        transform: translateY(0);
      }
      .imgsearch-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .imgsearch-btn-secondary {
        background: rgba(255,255,255,0.06);
        color: #9ca0b8;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .imgsearch-btn-secondary:hover {
        background: rgba(255,255,255,0.1);
        color: #e8eaf0;
        border-color: rgba(255,255,255,0.15);
      }
      .imgsearch-btns {
        display: flex;
        gap: 8px;
      }
      .imgsearch-dropzone {
        border: 2px dashed rgba(129, 140, 248, 0.25);
        border-radius: 10px;
        padding: 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: rgba(99, 102, 241, 0.04);
      }
      .imgsearch-dropzone:hover,
      .imgsearch-dropzone.active {
        border-color: rgba(129, 140, 248, 0.5);
        background: rgba(99, 102, 241, 0.1);
      }
      .imgsearch-dropzone-icon {
        font-size: 24px;
        margin-bottom: 4px;
      }
      .imgsearch-dropzone-text {
        font-size: 12px;
        color: #9ca0b8;
      }
      .imgsearch-dropzone-text strong {
        color: #818cf8;
      }
      .imgsearch-folder {
        font-size: 11px;
        color: #6b7094;
        padding: 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .imgsearch-progress {
        display: none;
        flex-direction: column;
        gap: 6px;
      }
      .imgsearch-progress.visible {
        display: flex;
      }
      .imgsearch-progress-bar {
        height: 4px;
        background: rgba(255,255,255,0.06);
        border-radius: 4px;
        overflow: hidden;
      }
      .imgsearch-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }
      .imgsearch-progress-text {
        font-size: 11px;
        color: #9ca0b8;
        text-align: center;
      }
      .imgsearch-minimized {
        display: none;
        cursor: pointer;
      }
      .imgsearch-minimized.visible {
        display: flex;
      }
      .imgsearch-fab {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
        transition: all 0.2s;
        border: none;
      }
      .imgsearch-fab:hover {
        transform: scale(1.05);
        box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5);
      }
    </style>

    <!-- Expanded panel -->
    <div class="imgsearch-card" id="imgsearch-expanded">
      <div class="imgsearch-header">
        <div class="imgsearch-brand">
          <div class="imgsearch-logo">🔍</div>
          <span class="imgsearch-title">ImgSearch</span>
        </div>
        <button class="imgsearch-close" id="imgsearch-minimize" title="Minimize">─</button>
      </div>
      <div class="imgsearch-body">
        <div class="imgsearch-stats">
          <div class="imgsearch-stats-icon">📷</div>
          <div class="imgsearch-stats-info">
            <div class="imgsearch-stats-count">${i}</div>
            <div class="imgsearch-stats-label">images found</div>
          </div>
        </div>

        <div class="imgsearch-folder" title="${t}">📂 ${t}</div>

        <div class="imgsearch-btns">
          <button class="imgsearch-btn imgsearch-btn-primary" id="imgsearch-index-btn">
            ⚡ Index All
          </button>
          <button class="imgsearch-btn imgsearch-btn-secondary" id="imgsearch-dashboard-btn">
            Dashboard →
          </button>
        </div>

        <div class="imgsearch-progress" id="imgsearch-progress">
          <div class="imgsearch-progress-bar">
            <div class="imgsearch-progress-fill" id="imgsearch-progress-fill"></div>
          </div>
          <div class="imgsearch-progress-text" id="imgsearch-progress-text">Sending to dashboard...</div>
        </div>

        <div class="imgsearch-dropzone" id="imgsearch-dropzone">
          <div class="imgsearch-dropzone-icon">🔎</div>
          <div class="imgsearch-dropzone-text">
            <strong>Drop</strong> or <strong>click</strong> to search by image
          </div>
        </div>
      </div>
    </div>

    <!-- Minimized FAB -->
    <div class="imgsearch-minimized" id="imgsearch-minimized">
      <button class="imgsearch-fab" id="imgsearch-fab" title="ImgSearch: ${i} images">🔍</button>
    </div>
  `,document.body.appendChild(e);const s=e.querySelector("#imgsearch-expanded"),a=e.querySelector("#imgsearch-minimized"),n=e.querySelector("#imgsearch-minimize"),p=e.querySelector("#imgsearch-fab"),l=e.querySelector("#imgsearch-index-btn"),y=e.querySelector("#imgsearch-dashboard-btn"),d=e.querySelector("#imgsearch-dropzone"),w=e.querySelector("#imgsearch-progress"),m=e.querySelector("#imgsearch-progress-fill"),h=e.querySelector("#imgsearch-progress-text");n.addEventListener("click",()=>{s.style.display="none",a.classList.add("visible")}),p.addEventListener("click",()=>{s.style.display="",a.classList.remove("visible")}),l.addEventListener("click",()=>{l.disabled=!0,l.textContent="⏳ Sending...",w.classList.add("visible"),m.style.width="30%",h.textContent=`Sending ${i} image URLs to dashboard...`,chrome.runtime.sendMessage({type:"INDEX_FOLDER",payload:{imageUrls:r,folderPath:t}},o=>{o!=null&&o.success?(m.style.width="100%",h.textContent="✅ Dashboard opened — indexing in progress!",l.textContent="✅ Sent!"):(h.textContent="❌ Failed to send. Try again.",l.disabled=!1,l.textContent="⚡ Index All")})}),y.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_DASHBOARD"})});const c=document.createElement("input");c.type="file",c.accept="image/*",c.style.display="none",e.appendChild(c),d.addEventListener("click",()=>c.click()),d.addEventListener("dragover",o=>{o.preventDefault(),d.classList.add("active")}),d.addEventListener("dragleave",()=>{d.classList.remove("active")}),d.addEventListener("drop",o=>{var b;o.preventDefault(),d.classList.remove("active");const g=(b=o.dataTransfer)==null?void 0:b.files[0];g&&g.type.startsWith("image/")&&x(g)}),c.addEventListener("change",()=>{var g;const o=(g=c.files)==null?void 0:g[0];o&&x(o),c.value=""})}function x(r){const t=new FileReader;t.onload=()=>{const i=t.result;chrome.runtime.sendMessage({type:"OPEN_DASHBOARD",payload:{queryImageDataUrl:i}})},t.readAsDataURL(r)}function u(){if(!k()||!E())return;const r=L();r.length!==0&&(console.log(`[ImgSearch] Detected ${r.length} images in local folder`),I(r))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",u):u();
})()
