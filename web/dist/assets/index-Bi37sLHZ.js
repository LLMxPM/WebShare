(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const m of i.addedNodes)m.tagName==="LINK"&&m.rel==="modulepreload"&&n(m)}).observe(document,{childList:!0,subtree:!0});function s(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(o){if(o.ep)return;o.ep=!0;const i=s(o);fetch(o.href,i)}})();async function c(e,t={}){const s=new Headers(t.headers);t.body&&!(t.body instanceof FormData)&&!s.has("Content-Type")&&s.set("Content-Type","application/json");const n=await fetch(e,{...t,headers:s,credentials:"same-origin"}),o=await n.text(),i=o?JSON.parse(o):{};if(!n.ok){const m=new Error(i.error||"请求失败");throw m.status=n.status,m}return i}function C(e,t){const s=new FormData;return s.set("file",t),c(e,{method:"POST",body:s})}function D(e,t){const s=R(t),n=new FormData;return n.set("manifest",JSON.stringify({files:s.map((o,i)=>({field:`file_${i}`,path:o.path,size:o.file.size}))})),s.forEach((o,i)=>n.append(`file_${i}`,o.file,o.file.name)),c(e,{method:"POST",body:n})}function R(e){const t=Array.from(e).map(s=>({file:s,path:B(s)})).filter(s=>s.path);if(!t.length)throw new Error("请选择包含文件的文件夹");return t}function B(e){const s=(e.webkitRelativePath||e.name).replaceAll("\\","/").split("/").filter(Boolean);return s.length>1?s.slice(1).join("/"):s[0]||""}const r={me:()=>c("/api/me"),updateMe:e=>c("/api/me",{method:"PATCH",body:JSON.stringify(e)}),changeOwnPassword:(e,t)=>c("/api/me/password",{method:"POST",body:JSON.stringify({currentPassword:e,newPassword:t})}),login:(e,t)=>c("/api/auth/login",{method:"POST",body:JSON.stringify({username:e,password:t})}),logout:()=>c("/api/auth/logout",{method:"POST"}),users:()=>c("/api/users"),createUser:e=>c("/api/users",{method:"POST",body:JSON.stringify(e)}),updateUser:(e,t)=>c(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(t)}),resetPassword:(e,t)=>c(`/api/users/${e}/reset-password`,{method:"POST",body:JSON.stringify({password:t})}),projects:()=>c("/api/projects"),createProject:e=>c("/api/projects",{method:"POST",body:JSON.stringify(e)}),updateProject:(e,t)=>c(`/api/projects/${e}`,{method:"PATCH",body:JSON.stringify(t)}),activateProject:e=>c(`/api/projects/${e}/activate`,{method:"POST"}),deactivateProject:e=>c(`/api/projects/${e}/deactivate`,{method:"POST"}),deleteProject:e=>c(`/api/projects/${e}`,{method:"DELETE"}),publishZip:(e,t)=>C(`/api/projects/${e}/publish/zip`,t),publishHtml:(e,t)=>C(`/api/projects/${e}/publish/html`,t),publishFolder:(e,t)=>D(`/api/projects/${e}/publish/folder`,t),packageExeUrl:e=>`/api/projects/${e}/packages/exe`,versions:e=>c(`/api/projects/${e}/versions`),activateVersion:(e,t)=>c(`/api/projects/${e}/versions/${t}/activate`,{method:"POST"}),files:(e,t)=>c(`/api/projects/${e}/files?path=${encodeURIComponent(t)}`),putFile:(e,t,s)=>fetch(`/api/projects/${e}/files?path=${encodeURIComponent(t)}`,{method:"PUT",body:s,credentials:"same-origin"}).then(async n=>{const o=await n.json();if(!n.ok)throw new Error(o.error||"上传失败");return o}),deleteFile:(e,t)=>c(`/api/projects/${e}/files?path=${encodeURIComponent(t)}`,{method:"DELETE"}),shareKey:e=>c(`/api/projects/${e}/share-key`,{method:"POST"}),publicHost:()=>c("/api/system/public-host"),updatePublicHost:e=>c("/api/system/public-host",{method:"PATCH",body:JSON.stringify({publicHost:e})}),networkSettings:()=>c("/api/system/network"),updateNetworkSettings:e=>c("/api/system/network",{method:"PATCH",body:JSON.stringify(e)})},a={me:null,users:[],projects:[],selectedId:null,versions:[],files:[],publicHostInfo:null,networkSettings:null,filePath:"",activeView:"projects",activeProjectTab:"overview",projectSearch:"",projectShareFilter:"all",projectTagFilters:[],createModalOpen:!1,accountModalOpen:!1,accountModalFocus:"email",userSearch:"",userModal:null,message:"",error:"",shareUrl:""},h=document.querySelector("#app"),x="/admin/icons/webshare-logo.svg",Z="/admin/icons/webshare-icon.svg";async function J(){try{const{user:e}=await r.me();a.me=e,await p()}catch{a.me=null}u()}async function p(){if(!a.me)return;const e=a.me.role==="admin";(a.activeView==="users"||a.activeView==="share")&&!e&&(a.activeView="projects");const[{projects:t}]=await Promise.all([r.projects(),e?W():Promise.resolve()]);a.projects=t??[],_(),(!a.selectedId||!a.projects.some(s=>s.id===a.selectedId))&&(a.selectedId=a.projects[0]?.id??null),await j()}async function v(){const{users:e}=await r.users();a.users=e??[]}async function W(){await Promise.all([v(),U(),K()])}async function U(){a.publicHostInfo=await r.publicHost()}async function K(){const{network:e}=await r.networkSettings();a.networkSettings=e}async function j(){const e=g();if(!e||!e.currentVersionId){a.versions=[],a.files=[];return}const[{versions:t},{files:s}]=await Promise.all([r.versions(e.id),r.files(e.id,a.filePath)]);a.versions=t??[],a.files=s??[]}function g(){return a.projects.find(e=>e.id===a.selectedId)||null}function X(){const e=a.projectSearch.trim().toLowerCase(),t=a.projectTagFilters.map(s=>s.toLowerCase());return a.projects.filter(s=>{const n=s.tags??[],o=new Set(n.map(f=>f.toLowerCase())),i=!e||s.name.toLowerCase().includes(e)||s.slug.toLowerCase().includes(e)||n.some(f=>f.toLowerCase().includes(e)),m=a.projectShareFilter==="all"||s.shareState===a.projectShareFilter,y=t.every(f=>o.has(f));return i&&m&&y})}function k(){const e=[],t=new Set;return a.projects.forEach(s=>{(s.tags??[]).forEach(n=>{const o=n.toLowerCase();t.has(o)||(t.add(o),e.push(n))})}),e.sort((s,n)=>s.localeCompare(n,"zh-CN"))}function _(){const e=new Set(k().map(t=>t.toLowerCase()));a.projectTagFilters=a.projectTagFilters.filter(t=>e.has(t.toLowerCase()))}function G(){const e=a.userSearch.trim().toLowerCase();return e?a.users.filter(t=>t.username.toLowerCase().includes(e)||(t.email||"").toLowerCase().includes(e)||I(t.role).toLowerCase().includes(e)):a.users}function u(){h.innerHTML=a.me?Y():Q(),Le()}function Q(){return`
    <main class="login-shell">
      <section class="login-frame" aria-label="WebShare 登录">
        <div class="login-visual" aria-hidden="true">
          <div class="login-visual-surface">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <img class="login-visual-icon" src="${Z}" alt="" />
        </div>
        <form class="login-panel" data-form="login">
          <div class="login-brand">
            <img class="brand-logo large" src="${x}" alt="WebShare" />
            <div>
              <h1>登录 WebShare</h1>
              <p>内部管理控制台</p>
            </div>
          </div>
          ${$()}
          <div class="login-fields">
            <label class="login-field">用户名 / 邮箱<input name="username" autocomplete="username" required autofocus /></label>
            <label class="login-field">密码<input name="password" type="password" autocomplete="current-password" required /></label>
          </div>
          <button class="primary block login-submit" type="submit">登录</button>
        </form>
      </section>
    </main>
  `}function Y(){const e=a.activeView==="projects";return`
    <main class="console-shell ${e?"":"single-workspace"}">
      ${te()}
      ${e?se():""}
      <section class="workspace">
        ${ee()}
      </section>
      ${a.createModalOpen&&e?ie():""}
      ${a.accountModalOpen?ae():""}
      ${a.userModal&&a.activeView==="users"?Se():""}
    </main>
  `}function ee(){return a.activeView==="users"?we():a.activeView==="share"?Te():ce()}function te(){const e=a.me;return`
    <aside class="global-nav">
      <div class="brand">
        <img class="brand-logo compact" src="${x}" alt="WebShare" />
      </div>
      <nav class="nav-stack">
        <button class="nav-item ${a.activeView==="projects"?"active":""}" data-action="set-view" data-view="projects">
          <span>项目</span><b>${a.projects.length}</b>
        </button>
        ${e.role==="admin"?`<button class="nav-item ${a.activeView==="share"?"active":""}" data-action="set-view" data-view="share">
                <span>分享地址</span><b>IP</b>
              </button>
              <button class="nav-item ${a.activeView==="users"?"active":""}" data-action="set-view" data-view="users">
                <span>用户</span><b>${a.users.length}</b>
              </button>`:""}
      </nav>
      <div class="account-box">
        <div>
          <strong>${l(e.username)}</strong>
          <span>${I(e.role)}${e.email?` · ${l(e.email)}`:""}</span>
        </div>
        <div class="account-actions">
          <button data-action="open-account-modal">账号设置</button>
          <button data-action="logout">退出</button>
        </div>
      </div>
    </aside>
  `}function ae(){const e=a.me,t=a.accountModalFocus==="email"?"autofocus":"",s=a.accountModalFocus==="password"?"autofocus":"",n=`
    <form class="modal-form" data-form="account-email">
      <label>邮箱<input name="email" type="email" value="${d(e.email||"")}" placeholder="name@example.com" ${t} /></label>
      <div class="modal-actions">
        <button class="primary" type="submit">保存邮箱</button>
      </div>
    </form>
  `,o=`
    <form class="modal-form account-password-form" data-form="account-password">
      <label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required ${s} /></label>
      <label>新密码<input name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
      <div class="modal-actions">
        <button type="button" data-action="close-account-modal">取消</button>
        <button class="primary" type="submit">修改密码</button>
      </div>
    </form>
  `;return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="账号设置">
        <div class="modal-head">
          <div>
            <span class="eyebrow">账号设置</span>
            <h2>${l(e.username)}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-account-modal">关闭</button>
        </div>
        <div class="account-modal-tabs">
          <button class="${a.accountModalFocus==="email"?"active":""}" type="button" data-action="set-account-focus" data-focus="email">修改邮箱</button>
          <button class="${a.accountModalFocus==="password"?"active":""}" type="button" data-action="set-account-focus" data-focus="password">修改密码</button>
        </div>
        ${$()}
        ${a.accountModalFocus==="password"?o:n}
      </section>
    </div>
  `}function se(){const e=X(),t=k();return`
    <aside class="project-column">
      <div class="column-head">
        <div>
          <h2>项目</h2>
          <span class="muted project-count">${e.length} / ${a.projects.length}</span>
        </div>
        <button class="primary" data-action="open-create-modal">新建</button>
      </div>
      <div class="project-filters">
        <div class="filter-row">
          <input data-input="project-search" value="${d(a.projectSearch)}" placeholder="搜索项目名称、标识或标签" />
          <select data-change="share-filter">
            ${b("all","全部状态",a.projectShareFilter)}
            ${b("public","公开",a.projectShareFilter)}
            ${b("share","密钥分享",a.projectShareFilter)}
            ${b("unshared","不分享",a.projectShareFilter)}
          </select>
        </div>
        ${t.length?ne(t):""}
      </div>
      <div class="project-list">${e.map(le).join("")||'<p class="empty">没有匹配项目</p>'}</div>
    </aside>
  `}function ne(e){return`
    <div class="tag-filter-row" aria-label="项目标签筛选">
      ${e.map(t=>oe(t)).join("")}
      ${a.projectTagFilters.length?'<button class="tag-filter clear" data-action="clear-tag-filter" type="button">清除</button>':""}
    </div>
  `}function oe(e){return`<button class="tag-filter ${a.projectTagFilters.some(s=>s.toLowerCase()===e.toLowerCase())?"active":""}" data-action="toggle-tag-filter" data-tag="${d(e)}" type="button">${l(e)}</button>`}function H(e,t){if(!e.length)return"";const s=new Set((t??[]).map(n=>n.toLowerCase()));return`
    <div class="tag-picker">
      <span>已有标签</span>
      <div class="tag-choice-row">
        ${e.map(n=>re(n,s.has(n.toLowerCase()))).join("")}
      </div>
    </div>
  `}function re(e,t){return`<button class="tag-choice ${t?"active":""}" data-action="toggle-form-tag" data-tag="${d(e)}" type="button">${l(e)}</button>`}function ie(){const e=k();return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel create-project-panel" role="dialog" aria-modal="true" aria-label="创建项目">
        <div class="modal-head">
          <div>
            <span class="eyebrow">新建项目</span>
            <h2>创建并发布</h2>
          </div>
          <button class="ghost" type="button" data-action="close-create-modal">关闭</button>
        </div>
        <form class="modal-form create-project-form" data-form="project">
          <label>项目名称<input name="name" placeholder="例如：后台管理系统" required autofocus /></label>
          <label>标签<input name="tags" placeholder="例如：客户A, 演示, 已上线" /></label>
          ${H(e,[])}
          <div class="create-upload-section">
            <div class="create-upload-head">
              <strong>发布内容（可选）</strong>
              <span>项目标识会按日期和随机码自动生成。</span>
            </div>
            <div class="create-upload-grid">
              <div class="upload-box create-upload-card">
                <div class="upload-title"><span class="upload-type">ZIP</span><strong>ZIP 构建产物</strong></div>
                <p>上传压缩后的构建目录。</p>
                <label class="upload-picker">
                  <input class="upload-input" name="zip" type="file" accept=".zip" data-create-file="zip" />
                  <span>选择 ZIP 文件</span>
                </label>
                <div class="upload-summary" data-upload-summary>未选择文件</div>
              </div>
              <div class="upload-box create-upload-card">
                <div class="upload-title"><span class="upload-type">DIR</span><strong>文件夹构建产物</strong></div>
                <p>直接选择 dist 文件夹。</p>
                <label class="upload-picker">
                  <input class="upload-input" name="folder" type="file" data-create-file="folder" webkitdirectory directory multiple />
                  <span>选择文件夹</span>
                </label>
                <div class="upload-summary" data-upload-summary>未选择文件夹</div>
              </div>
              <div class="upload-box create-upload-card">
                <div class="upload-title"><span class="upload-type">HTML</span><strong>单 HTML 文件</strong></div>
                <p>保存为 index.html。</p>
                <label class="upload-picker">
                  <input class="upload-input" name="html" type="file" accept=".html,.htm,text/html" data-create-file="html" />
                  <span>选择 HTML 文件</span>
                </label>
                <div class="upload-summary" data-upload-summary>未选择文件</div>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" data-action="close-create-modal">取消</button>
            <button class="primary" type="submit">创建项目</button>
          </div>
        </form>
      </section>
    </div>
  `}function le(e){const t=e.id===a.selectedId?"active":"",s=V(e.tags,"project-tags compact");return`
    <button class="project-item ${t}" data-action="select-project" data-id="${e.id}">
      <span class="project-name">${l(e.name)}</span>
      ${s}
      <span class="project-meta">
        <b>${l(e.slug)}</b>
        <em>${S(e.accessMode)}</em>
      </span>
      <span class="mini-pills">
        <i class="${e.active?"enabled":"disabled"}">${L(e.active)}</i>
        <i class="${e.shareState}">${T(e.shareState)}</i>
        <i>${e.currentVersionId?"已发布":"未发布"}</i>
      </span>
    </button>
  `}function ce(){const e=g();return e?`
    <div class="workspace-stack">
      ${$()}
      ${de(e)}
      ${ue(e)}
      ${pe(e)}
    </div>
  `:Fe()}function de(e){return`
    <section class="hero-panel">
      <div class="hero-main">
        <div class="status-row">
          <span class="pill ${e.active?"enabled":"disabled"}">${L(e.active)}</span>
          <span class="pill">${S(e.accessMode)}</span>
          <span class="pill ${e.shareState}">${T(e.shareState)}</span>
          <span class="pill">${e.spaEnabled?"SPA fallback":"普通静态"}</span>
        </div>
        <h1>${l(e.name)}</h1>
        <div class="slug-line">${l(e.slug)}</div>
        ${V(e.tags,"project-tags hero-tags")}
      </div>
      <div class="hero-actions">
        <button class="primary" data-action="copy-link" data-url="${d(e.accessUrl)}" ${e.active?"":"disabled"}>复制地址</button>
        ${e.active?`<a class="button-link" href="${d(e.accessUrl)}" target="_blank" rel="noreferrer">打开项目</a>`:"<button disabled>打开项目</button>"}
        ${e.currentVersionId?`<a class="button-link" href="${d(r.packageExeUrl(e.id))}">下载 EXE</a>`:"<button disabled>下载 EXE</button>"}
        <button data-action="set-tab" data-tab="publish">发布</button>
        <button data-action="share-key">分享密钥</button>
        ${e.active?'<button class="danger" data-action="deactivate-project">停用</button>':'<button class="primary" data-action="activate-project">激活</button>'}
      </div>
      <div class="access-strip">
        <span>访问地址</span>
        ${e.active?`<a href="${d(e.accessUrl)}" target="_blank" rel="noreferrer">${l(e.accessUrl)}</a>`:`<code>${l(e.accessUrl)}</code>`}
      </div>
      ${a.shareUrl?`<div class="access-strip key"><span>密钥链接</span><code>${l(a.shareUrl)}</code></div>`:""}
      <div class="summary-grid">
        ${w("BaseURL",e.detectedBaseUrl||"未识别")}
        ${w("入口文件",e.entryFile||"index.html")}
        ${w("挂载路径",e.mountPath||"-")}
        ${w("端口",e.port?String(e.port):"-")}
        ${w("运行状态",L(e.active))}
      </div>
    </section>
  `}function ue(e){return`
    <div class="tabs">
      ${[["overview","概览"],["publish","发布"],["files","文件"],["versions",`版本 ${a.versions.length}`],["settings","设置"]].map(([s,n])=>`<button class="${a.activeProjectTab===s?"active":""}" data-action="set-tab" data-tab="${s}">${n}</button>`).join("")}
      <button class="ghost danger" data-action="delete-project" data-id="${e.id}">删除项目</button>
    </div>
  `}function pe(e){switch(a.activeProjectTab){case"publish":return be(e);case"files":return fe(e);case"versions":return ve(e);case"settings":return ge(e);default:return me(e)}}function me(e){return`
    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <h3>运行状态</h3>
          <span>${e.active?e.currentVersionId?"已发布":"等待发布":"已停用"}</span>
        </div>
        ${je(e.warnings)}
        ${e.active?e.currentVersionId?`<div class="status-card success">
                <strong>当前项目可访问</strong>
                <span>访问模式为 ${S(e.accessMode)}，分享状态为 ${T(e.shareState)}。</span>
              </div>`:`<div class="status-card">
                <strong>还没有发布版本</strong>
                <span>上传 ZIP、文件夹构建产物或单 HTML 文件后，系统会识别 BaseURL 并生成访问地址。</span>
                <button class="primary" data-action="set-tab" data-tab="publish">去发布</button>
              </div>`:`<div class="status-card">
                <strong>项目已停用</strong>
                <span>访问模式为 ${S(e.accessMode)}，分享状态为 ${T(e.shareState)}。</span>
              </div>`}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h3>快捷操作</h3>
          <span>常用流程</span>
        </div>
        <div class="quick-grid">
          <button data-action="set-tab" data-tab="publish">上传新版本</button>
          <button data-action="set-tab" data-tab="files" ${e.currentVersionId?"":"disabled"}>管理文件</button>
          <button data-action="set-tab" data-tab="versions" ${a.versions.length?"":"disabled"}>查看版本</button>
          ${e.currentVersionId?`<a class="button-link" href="${d(r.packageExeUrl(e.id))}">下载 EXE</a>`:"<button disabled>下载 EXE</button>"}
          <button data-action="set-tab" data-tab="settings">调整设置</button>
        </div>
      </div>
    </section>
  `}function be(e){return`
    <section class="panel">
      <div class="panel-head">
        <h3>发布项目</h3>
        <span>当前版本 ${e.currentVersionId||"-"}</span>
      </div>
      <div class="publish-grid">
        <div class="upload-box">
          <div class="upload-title"><span class="upload-type">ZIP</span><strong>ZIP 构建产物</strong></div>
          <p>适合已经压缩好的 Vite、Vue、React、Webpack 构建目录。</p>
          <label class="upload-picker">
            <input class="upload-input" name="zip" type="file" accept=".zip" data-file="zip" />
            <span>选择 ZIP 文件</span>
          </label>
          <div class="upload-summary" data-upload-summary="zip">未选择文件</div>
          <button class="primary" data-action="publish-zip" data-id="${e.id}">上传 ZIP</button>
        </div>
        <div class="upload-box">
          <div class="upload-title"><span class="upload-type">DIR</span><strong>文件夹构建产物</strong></div>
          <p>直接选择 dist 文件夹，系统会保留内部目录结构并创建完整版本。</p>
          <label class="upload-picker">
            <input class="upload-input" name="folder" type="file" data-file="folder" webkitdirectory directory multiple />
            <span>选择文件夹</span>
          </label>
          <div class="upload-summary" data-upload-summary="folder">未选择文件夹</div>
          <button class="primary" data-action="publish-folder" data-id="${e.id}">上传文件夹</button>
        </div>
        <div class="upload-box">
          <div class="upload-title"><span class="upload-type">HTML</span><strong>单 HTML 文件</strong></div>
          <p>上传后会保存为 index.html，适合没有独立静态资源的页面。</p>
          <label class="upload-picker">
            <input class="upload-input" name="html" type="file" accept=".html,.htm,text/html" data-file="html" />
            <span>选择 HTML 文件</span>
          </label>
          <div class="upload-summary" data-upload-summary="html">未选择文件</div>
          <button data-action="publish-html" data-id="${e.id}">上传 HTML</button>
        </div>
      </div>
    </section>
  `}function fe(e){const t=a.filePath.split("/").filter(Boolean).slice(0,-1).join("/");return e.currentVersionId?`
    <section class="panel">
      <div class="panel-head">
        <h3>文件管理</h3>
        <span>${a.files.length} 项</span>
      </div>
      <div class="pathbar">
        <button data-action="open-path" data-path="">根目录</button>
        ${a.filePath?`<button data-action="open-path" data-path="${d(t)}">上级</button>`:""}
        <code>/${l(a.filePath)}</code>
      </div>
      <form class="file-upload" data-form="file">
        <input name="path" placeholder="保存路径，例如 assets/logo.png" required />
        <input name="file" type="file" required />
        <button class="primary" type="submit">上传/替换</button>
      </form>
      <div class="table-list file-table">
        ${a.files.map(he).join("")||'<p class="empty">空目录</p>'}
      </div>
    </section>
  `:`<section class="panel">${E("当前项目还没有版本，发布后才能管理文件。")}</section>`}function he(e){return`
    <div class="table-row">
      <button class="file-cell" data-action="${e.isDir?"open-path":"noop"}" data-path="${d(e.path)}">
        <span class="file-badge">${e.isDir?"DIR":"FILE"}</span>
        <span>${l(e.name)}</span>
      </button>
      <span>${e.isDir?"目录":P(e.size)}</span>
      <button class="ghost danger" data-action="delete-file" data-path="${d(e.path)}">删除</button>
    </div>
  `}function ve(e){return`
    <section class="panel">
      <div class="panel-head">
        <h3>版本历史</h3>
        <span>${a.versions.length} 条</span>
      </div>
      <div class="table-list">
        ${a.versions.map(t=>`
              <div class="table-row">
                <div>
                  <strong>#${t.versionNumber}</strong>
                  <span>${l(t.sourceType)} · ${P(t.sizeBytes)} · ${z(t.createdAt)}</span>
                </div>
                <span>${l(t.detectedBaseUrl||"未识别")}</span>
                <button data-action="activate-version" data-version="${t.id}" ${t.id===e.currentVersionId?"disabled":""}>激活</button>
              </div>`).join("")||'<p class="empty">暂无版本</p>'}
      </div>
    </section>
  `}function ge(e){const t=k();return`
    <form class="panel" data-form="settings">
      <div class="panel-head">
        <h3>项目设置</h3>
        <span>低频配置</span>
      </div>
      <div class="field-grid">
        <label>名称<input name="name" value="${d(e.name)}" /></label>
        <label>项目标识<input name="slug" value="${d(e.slug)}" /></label>
        <div class="field-span">
          <label>标签<input name="tags" value="${d(N(e.tags))}" placeholder="例如：客户A, 演示, 已上线" /></label>
          ${H(t,e.tags)}
        </div>
        <label>入口文件<input name="entryFile" value="${d(e.entryFile)}" /></label>
        <label>挂载路径<input name="mountPath" value="${d(e.mountPath)}" placeholder="/demo/" /></label>
        <label>访问模式
          <select name="accessMode">
            ${b("path","路径",e.accessMode)}
            ${b("mount","挂载路径",e.accessMode)}
            ${b("port","独立端口",e.accessMode)}
          </select>
        </label>
        <label>分享状态
          <select name="shareState">
            ${b("public","公开",e.shareState)}
            ${b("share","密钥分享",e.shareState)}
            ${b("unshared","不分享",e.shareState)}
          </select>
        </label>
      </div>
      <label class="check"><input name="spaEnabled" type="checkbox" ${e.spaEnabled?"checked":""} /> SPA fallback</label>
      <div class="form-actions">
        <button class="primary" type="submit">保存设置</button>
      </div>
    </form>
  `}function we(){if(a.me?.role!=="admin")return`<section class="panel">${E("需要管理员权限。")}</section>`;const e=G();return`
    <div class="workspace-stack">
      ${$()}
      <section class="view-head">
        <div>
          <span class="eyebrow">用户管理</span>
          <h1>账号与权限</h1>
        </div>
        <button class="primary" data-action="open-user-modal" data-mode="create">创建用户</button>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>用户列表</h3>
          <span>${e.length} / ${a.users.length} 个账号</span>
        </div>
        <div class="user-toolbar">
          <input data-input="user-search" value="${d(a.userSearch)}" placeholder="搜索用户名、邮箱或角色" />
        </div>
        ${e.length?$e(e):'<p class="empty">没有匹配用户</p>'}
      </section>
    </div>
  `}function $e(e){return`
    <div class="user-table-wrap">
      <table class="user-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${e.map((t,s)=>ye(t,s)).join("")}
        </tbody>
      </table>
    </div>
  `}function ye(e,t){const s=e.id===a.me?.id,n=!e.disabled;return`
    <tr>
      <td>${t+1}</td>
      <td><strong>${l(e.username)}</strong></td>
      <td>${e.email?l(e.email):'<span class="muted">未设置</span>'}</td>
      <td>${I(e.role)}</td>
      <td><span class="state-badge ${e.disabled?"disabled":"enabled"}">${e.disabled?"已禁用":"启用中"}</span></td>
      <td>${z(e.createdAt)}</td>
      <td>
        <div class="user-actions">
          <button data-action="open-user-modal" data-mode="edit" data-id="${e.id}">编辑</button>
          <button data-action="open-user-modal" data-mode="reset" data-id="${e.id}">重置密码</button>
          <button data-action="toggle-user" data-id="${e.id}" data-disabled="${n}" ${s&&n?"disabled":""}>
            ${e.disabled?"启用":"禁用"}
          </button>
        </div>
      </td>
    </tr>
  `}function Se(){const e=a.userModal,t=e.userId?a.users.find(o=>o.id===e.userId):null;if(e.mode!=="create"&&!t)return"";if(e.mode==="reset"&&t)return`
      <div class="modal-backdrop" role="presentation">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-label="重置密码">
          <div class="modal-head">
            <div>
              <span class="eyebrow">重置密码</span>
              <h2>${l(t.username)}</h2>
            </div>
            <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
          </div>
          <form class="modal-form" data-form="user-reset" data-user-id="${t.id}">
            <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="8" required autofocus /></label>
            <div class="modal-actions">
              <button type="button" data-action="close-user-modal">取消</button>
              <button class="primary" type="submit">保存密码</button>
            </div>
          </form>
        </section>
      </div>
    `;const s=e.mode==="edit"&&!!t,n=t||null;return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="${s?"编辑用户":"创建用户"}">
        <div class="modal-head">
          <div>
            <span class="eyebrow">${s?"编辑用户":"创建用户"}</span>
            <h2>${s&&n?l(n.username):"新增账号"}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="${s?"user-edit":"user-create"}" ${s&&n?`data-user-id="${n.id}"`:""}>
          <label>用户名<input name="username" value="${d(n?.username||"")}" minlength="3" required autofocus /></label>
          <label>邮箱<input name="email" type="email" value="${d(n?.email||"")}" placeholder="name@example.com" ${s?"":"required"} /></label>
          ${s?"":'<label>初始密码<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>'}
          <label>角色
            <select name="role">
              ${b("user","用户",n?.role||"user")}
              ${b("admin","管理员",n?.role||"user")}
            </select>
          </label>
          ${s?`<label class="check"><input name="disabled" type="checkbox" ${n?.disabled?"checked":""} ${n?.id===a.me?.id?"disabled":""} /> 禁用账号</label>`:""}
          <div class="modal-actions">
            <button type="button" data-action="close-user-modal">取消</button>
            <button class="primary" type="submit">${s?"保存用户":"创建用户"}</button>
          </div>
        </form>
      </section>
    </div>
  `}function Te(){if(a.me?.role!=="admin")return`<section class="panel">${E("需要管理员权限。")}</section>`;const e=a.publicHostInfo?.publicHost||"未设置",t=a.networkSettings,s=t?.activeSharePort??8081,n=t?`${t.activePortStart}-${t.activePortEnd}`:"12000-12999";return`
    <div class="workspace-stack">
      ${$()}
      <section class="view-head">
        <div>
          <span class="eyebrow">分享地址</span>
          <h1>访问网络配置</h1>
        </div>
        <span>只有管理员可以修改项目访问地址使用的主机和端口。</span>
      </section>
      <section class="panel">
        ${Pe()}
      </section>
      <section class="panel">
        ${ke()}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>地址生成规则</h3>
          <span>当前主机：${l(e)}</span>
        </div>
        <div class="info-list">
          <div><strong>管理后台</strong><span>继续使用 8080 端口，不受分享地址设置影响。</span></div>
          <div><strong>路径分享</strong><span>项目地址会按当前主机和 ${s} 分享端口生成。</span></div>
          <div><strong>独立端口</strong><span>端口模式项目会从 ${n} 中分配端口。</span></div>
        </div>
      </section>
    </div>
  `}function Pe(){const e=a.publicHostInfo,t=e?.candidates??[],s=e?.publicHost??"",n=a.networkSettings?.activeSharePort??8081,o=s||"未设置",i=s?`${window.location.protocol}//${Xe(s)}:${n}/`:"未设置";return`
    <div class="address-layout">
      <div class="address-current">
        <span class="eyebrow">当前地址</span>
        <h3>分享网关地址</h3>
        <code class="current-address">${l(i)}</code>
        <div class="address-meta">
          <div><strong>当前主机</strong><span>${l(o)}</span></div>
          <div><strong>当前端口</strong><span>路径分享使用 ${n}；独立端口项目使用项目自己的端口。</span></div>
        </div>
      </div>
      <form class="address-form" data-form="public-host">
        <div class="address-form-head">
          <h3>修改地址</h3>
          <span>选择检测到的本机地址，或输入自定义 IP / 主机名。</span>
        </div>
        <label>本机地址
          <select name="publicHost">
            ${t.map(m=>b(m,m,s)).join("")}
          </select>
        </label>
        <label>自定义地址
          <input name="customHost" placeholder="例如 192.168.1.20 或 host.local" />
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">保存地址</button>
        </div>
        <div class="hint">保存后会刷新项目列表和项目访问地址。</div>
      </form>
    </div>
  `}function ke(){const e=a.networkSettings,t=e?.sharePort??8081,s=e?.portStart??12e3,n=e?.portEnd??12999,o=e?`${e.activePortStart}-${e.activePortEnd}`:"12000-12999";return`
    <form class="network-form" data-form="network-settings">
      <div class="panel-head compact">
        <div>
          <h3>端口配置</h3>
          <span>保存后重启软件生效。</span>
        </div>
        ${e?.restartRequired?'<span class="restart-badge">待重启</span>':'<span class="restart-badge ready">已生效</span>'}
      </div>
      <div class="network-grid">
        <label>分享网关端口<input name="sharePort" type="number" min="1" max="65535" value="${t}" required /></label>
        <label>独立端口起点<input name="portStart" type="number" min="1" max="65535" value="${s}" required /></label>
        <label>独立端口终点<input name="portEnd" type="number" min="1" max="65535" value="${n}" required /></label>
      </div>
      <div class="runtime-strip">
        <span>当前运行：分享网关 ${e?.activeSharePort??8081}，独立端口 ${o}</span>
      </div>
      <div class="form-actions">
        <button class="primary" type="submit">保存端口配置</button>
      </div>
    </form>
  `}function Fe(){return`
    <section class="empty-state">
      <h2>还没有项目</h2>
      <p>在中栏创建项目后，上传 ZIP、文件夹或 HTML 即可获得访问地址。</p>
    </section>
  `}function E(e){return`<div class="inline-empty">${l(e)}</div>`}function je(e){const t=e??[];return t.length?`<ul class="warnings">${t.map(s=>`<li>${l(s)}</li>`).join("")}</ul>`:""}function $(){return`${a.error?`<div class="notice error">${l(a.error)}</div>`:""}${a.message?`<div class="notice">${l(a.message)}</div>`:""}`}function Le(){h.querySelectorAll("form").forEach(e=>e.addEventListener("submit",Ce)),h.querySelectorAll("[data-action]").forEach(e=>e.addEventListener("click",Oe)),h.querySelectorAll("input[data-file]").forEach(e=>e.addEventListener("change",O)),h.querySelectorAll("input[data-create-file]").forEach(e=>e.addEventListener("change",O)),h.querySelector('[data-input="project-search"]')?.addEventListener("input",Ee),h.querySelector('[data-input="user-search"]')?.addEventListener("input",Me),h.querySelector('[data-change="share-filter"]')?.addEventListener("change",Ie)}function Ee(e){a.projectSearch=e.currentTarget.value,u()}function Me(e){a.userSearch=e.currentTarget.value,u()}function Ie(e){a.projectShareFilter=e.currentTarget.value,u()}function O(e){const t=e.currentTarget,s=t.dataset.file||t.dataset.createFile;t.dataset.createFile&&We(t);const o=t.closest(".upload-box")?.querySelector("[data-upload-summary]");o&&(o.textContent=A(s,t))}async function Ce(e){e.preventDefault();const t=e.currentTarget,s=new FormData(t);await q(async()=>{switch(t.dataset.form){case"login":{const{user:n}=await r.login(String(s.get("username")),String(s.get("password")));a.me=n,a.activeView="projects",await p();break}case"project":{const n=Ve(t),{project:o}=await r.createProject({name:String(s.get("name")),tags:M(String(s.get("tags")||""))});a.selectedId=o.id,a.activeProjectTab="overview",a.createModalOpen=!1,await p(),n&&await Ne(o.id,n),await p();break}case"settings":await xe(t);break;case"account-email":await ze(t);break;case"account-password":await De(t);break;case"file":await Ae(t);break;case"user-create":await r.createUser({username:String(s.get("username")),email:String(s.get("email")),password:String(s.get("password")),role:String(s.get("role"))}),a.userModal=null,await v();break;case"user-edit":await Re(t);break;case"user-reset":await Be(t);break;case"public-host":{const n=String(s.get("customHost")||"").trim(),o=String(s.get("publicHost")||"").trim();await r.updatePublicHost(n||o),await p();break}case"network-settings":{const{network:n}=await r.updateNetworkSettings({sharePort:Number(s.get("sharePort")),portStart:Number(s.get("portStart")),portEnd:Number(s.get("portEnd"))});a.networkSettings=n,a.message=n.restartRequired?"端口配置已保存，重启软件后生效":"端口配置已保存",await p();break}}})}async function Oe(e){const t=e.currentTarget,s=t.dataset.action;if(s!=="noop"){if(s==="set-view"){const n=t.dataset.view||"projects";a.activeView=a.me?.role==="admin"||n==="projects"?n:"projects",a.createModalOpen=!1,a.accountModalOpen=!1,a.userModal=null,a.error="",a.message="";try{a.activeView==="users"&&await v(),a.activeView==="share"&&await U()}catch(o){a.error=o instanceof Error?o.message:"加载视图失败"}u();return}if(s==="toggle-tag-filter"){Ue(t.dataset.tag||""),a.error="",a.message="",u();return}if(s==="clear-tag-filter"){a.projectTagFilters=[],a.error="",a.message="",u();return}if(s==="toggle-form-tag"){He(t);return}if(s==="set-tab"){a.activeProjectTab=t.dataset.tab||"overview",a.error="",a.message="",u();return}if(s==="select-project"){a.selectedId=Number(t.dataset.id),a.filePath="",a.shareUrl="",a.activeProjectTab="overview",a.error="",a.message="",await j(),u();return}if(s==="open-path"){a.filePath=t.dataset.path||"",a.error="",a.message="",await j(),u();return}if(s==="open-create-modal"){a.createModalOpen=!0,a.accountModalOpen=!1,a.error="",a.message="",u();return}if(s==="close-create-modal"){a.createModalOpen=!1,a.error="",a.message="",u();return}if(s==="open-account-modal"){a.accountModalOpen=!0,a.accountModalFocus="email",a.createModalOpen=!1,a.userModal=null,a.error="",a.message="",u();return}if(s==="set-account-focus"){a.accountModalFocus=t.dataset.focus||"email",a.error="",a.message="",u();return}if(s==="close-account-modal"){a.accountModalOpen=!1,a.error="",a.message="",u();return}if(s==="open-user-modal"){a.userModal={mode:t.dataset.mode||"create",userId:Number(t.dataset.id)||void 0},a.accountModalOpen=!1,a.error="",a.message="",u();return}if(s==="close-user-modal"){a.userModal=null,a.error="",a.message="",u();return}await q(async()=>{const n=g();switch(s){case"logout":await r.logout(),a.me=null,a.accountModalOpen=!1,a.activeView="projects",a.selectedId=null;break;case"copy-link":await Je(t.dataset.url||""),a.message="访问地址已复制";break;case"publish-zip":await F("zip");break;case"publish-folder":await F("folder");break;case"publish-html":await F("html");break;case"share-key":if(n){const o=await r.shareKey(n.id);a.shareUrl=o.shareUrl,a.message="分享密钥已生成",await p()}break;case"activate-project":n&&(await r.activateProject(n.id),await p());break;case"deactivate-project":n&&confirm("确认停用该项目？")&&(await r.deactivateProject(n.id),await p());break;case"activate-version":n&&await r.activateVersion(n.id,Number(t.dataset.version)),a.activeProjectTab="overview",await p();break;case"delete-file":n&&confirm("确认删除该路径？")&&(await r.deleteFile(n.id,t.dataset.path||""),await p());break;case"delete-project":n&&confirm("确认删除该项目？")&&(await r.deleteProject(n.id),a.selectedId=null,await p());break;case"toggle-user":await Ze(Number(t.dataset.id),t.dataset.disabled==="true");break}})}}async function xe(e){const t=g();if(!t)return;const s=new FormData(e);await r.updateProject(t.id,{name:String(s.get("name")),slug:String(s.get("slug")),tags:M(String(s.get("tags")||"")),entryFile:String(s.get("entryFile")),mountPath:String(s.get("mountPath")),accessMode:String(s.get("accessMode")),shareState:String(s.get("shareState")),spaEnabled:!!s.get("spaEnabled")}),a.activeProjectTab="overview",await p()}function Ue(e){const t=e.trim();if(!t)return;const s=t.toLowerCase();if(a.projectTagFilters.some(n=>n.toLowerCase()===s)){a.projectTagFilters=a.projectTagFilters.filter(n=>n.toLowerCase()!==s);return}a.projectTagFilters=[...a.projectTagFilters,t]}function He(e){const t=(e.dataset.tag||"").trim(),s=e.closest("form"),n=s?.querySelector('input[name="tags"]');if(!t||!s||!n)return;const o=t.toLowerCase(),i=M(n.value),y=i.some(f=>f.toLowerCase()===o)?i.filter(f=>f.toLowerCase()!==o):[...i,t];n.value=N(y),qe(s,y)}function qe(e,t){const s=new Set(t.map(n=>n.toLowerCase()));e.querySelectorAll('[data-action="toggle-form-tag"]').forEach(n=>{n.classList.toggle("active",s.has((n.dataset.tag||"").toLowerCase()))})}function Ve(e){const t=e.querySelector('input[data-create-file="zip"]')?.files?.[0];if(t&&t.size>0){if(!t.name.toLowerCase().endsWith(".zip"))throw new Error("创建时 ZIP 发布只支持 .zip 文件");return{kind:"zip",file:t}}const s=e.querySelector('input[data-create-file="folder"]')?.files;if(s?.length)return{kind:"folder",files:s};const n=e.querySelector('input[data-create-file="html"]')?.files?.[0];if(n&&n.size>0){const o=n.name.toLowerCase();if(!o.endsWith(".html")&&!o.endsWith(".htm"))throw new Error("创建时 HTML 发布只支持 .html 或 .htm 文件");return{kind:"html",file:n}}return null}async function Ne(e,t){if(t.kind==="folder"){if(!t.files?.length)throw new Error("请选择文件夹");await r.publishFolder(e,t.files);return}if(!t.file)throw new Error("请选择文件");t.kind==="zip"?await r.publishZip(e,t.file):await r.publishHtml(e,t.file)}async function F(e){const t=g();if(!t)return;const s=h.querySelector(`input[data-file="${e}"]`);if(e==="folder"){const n=s?.files;if(!n?.length)throw new Error("请选择文件夹");await r.publishFolder(t.id,n)}else{const n=s?.files?.[0];if(!n)throw new Error("请选择文件");e==="zip"?await r.publishZip(t.id,n):await r.publishHtml(t.id,n)}a.activeProjectTab="overview",await p()}async function Ae(e){const t=g();if(!t)return;const s=new FormData(e),n=s.get("file");if(!(n instanceof File))throw new Error("请选择文件");await r.putFile(t.id,String(s.get("path")),n),await p(),a.activeProjectTab="files"}async function ze(e){const t=String(new FormData(e).get("email")||""),{user:s}=await r.updateMe({email:t});a.me=s,s.role==="admin"&&await v(),a.message="邮箱已保存"}async function De(e){const t=new FormData(e);await r.changeOwnPassword(String(t.get("currentPassword")),String(t.get("newPassword"))),a.message="密码已修改"}async function Re(e){const t=Number(e.dataset.userId),s=a.users.find(m=>m.id===t);if(!s)throw new Error("用户不存在");const n=new FormData(e),o=s.id===a.me?.id?!1:!!n.get("disabled"),{user:i}=await r.updateUser(t,{username:String(n.get("username")),email:String(n.get("email")),role:String(n.get("role")),disabled:o});a.me?.id===i.id&&(a.me=i),a.userModal=null,await v()}async function Be(e){const t=Number(e.dataset.userId),s=String(new FormData(e).get("password"));await r.resetPassword(t,s),a.userModal=null,await v()}async function Ze(e,t){const s=a.users.find(n=>n.id===e);if(!s)throw new Error("用户不存在");await r.updateUser(e,{username:s.username,email:s.email||"",role:s.role,disabled:t}),await v()}async function q(e){a.error="",a.message="";try{await e(),a.message||(a.message="操作完成")}catch(t){a.error=t instanceof Error?t.message:"操作失败"}u()}async function Je(e){if(!e)throw new Error("没有可复制的地址");if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(e);return}const t=document.createElement("textarea");t.value=e,t.style.position="fixed",t.style.opacity="0",document.body.appendChild(t),t.select(),document.execCommand("copy"),t.remove()}function w(e,t){return`<div class="summary-item"><span>${l(e)}</span><strong>${l(t)}</strong></div>`}function V(e,t){const s=e??[];return s.length?`<span class="${t}">${s.map(n=>`<i>${l(n)}</i>`).join("")}</span>`:""}function M(e){return e.split(/[,，]/).map(t=>t.trim()).filter(Boolean)}function N(e){return(e??[]).join(", ")}function b(e,t,s){return`<option value="${e}" ${e===s?"selected":""}>${t}</option>`}function I(e){return e==="admin"?"管理员":"用户"}function L(e){return e?"运行中":"已停用"}function S(e){return{path:"路径",mount:"挂载",port:"端口"}[e]||e}function T(e){return{public:"公开",share:"密钥分享",unshared:"不分享"}[e]||e}function P(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function A(e,t){const s=Array.from(t.files??[]);if(!s.length)return e==="folder"?"未选择文件夹":"未选择文件";if(e!=="folder")return`${s[0].name} · ${P(s[0].size)}`;const n=s.reduce((o,i)=>o+i.size,0);return`${Ke(s)} · ${s.length} 个文件 · ${P(n)}`}function We(e){e.closest("form")?.querySelectorAll("input[data-create-file]").forEach(s=>{if(s===e)return;s.value="";const n=s.dataset.createFile,o=s.closest(".upload-box")?.querySelector("[data-upload-summary]");o&&(o.textContent=A(n,s))})}function Ke(e){return(e[0].webkitRelativePath||"").replaceAll("\\","/").split("/").filter(Boolean)[0]||"已选文件夹"}function z(e){return e?new Date(e).toLocaleString("zh-CN",{hour12:!1}):"-"}function l(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function d(e){return l(e||"")}function Xe(e){return e.includes(":")&&!e.startsWith("[")?`[${e}]`:e}J();
