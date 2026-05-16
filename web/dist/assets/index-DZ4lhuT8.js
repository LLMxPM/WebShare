(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const c of i)if(c.type==="childList")for(const b of c.addedNodes)b.tagName==="LINK"&&b.rel==="modulepreload"&&n(b)}).observe(document,{childList:!0,subtree:!0});function s(i){const c={};return i.integrity&&(c.integrity=i.integrity),i.referrerPolicy&&(c.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?c.credentials="include":i.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function n(i){if(i.ep)return;i.ep=!0;const c=s(i);fetch(i.href,c)}})();async function l(e,a={}){const s=new Headers(a.headers);a.body&&!(a.body instanceof FormData)&&!s.has("Content-Type")&&s.set("Content-Type","application/json");const n=await fetch(e,{...a,headers:s,credentials:"same-origin"}),i=await n.text(),c=i?JSON.parse(i):{};if(!n.ok){const b=new Error(c.error||"请求失败");throw b.status=n.status,b}return c}function F(e,a){const s=new FormData;return s.set("file",a),l(e,{method:"POST",body:s})}function H(e,a){const s=q(a),n=new FormData;return n.set("manifest",JSON.stringify({files:s.map((i,c)=>({field:`file_${c}`,path:i.path,size:i.file.size}))})),s.forEach((i,c)=>n.append(`file_${c}`,i.file,i.file.name)),l(e,{method:"POST",body:n})}function q(e){const a=Array.from(e).map(s=>({file:s,path:V(s)})).filter(s=>s.path);if(!a.length)throw new Error("请选择包含文件的文件夹");return a}function V(e){const s=(e.webkitRelativePath||e.name).replaceAll("\\","/").split("/").filter(Boolean);return s.length>1?s.slice(1).join("/"):s[0]||""}const r={me:()=>l("/api/me"),updateMe:e=>l("/api/me",{method:"PATCH",body:JSON.stringify(e)}),changeOwnPassword:(e,a)=>l("/api/me/password",{method:"POST",body:JSON.stringify({currentPassword:e,newPassword:a})}),login:(e,a)=>l("/api/auth/login",{method:"POST",body:JSON.stringify({username:e,password:a})}),logout:()=>l("/api/auth/logout",{method:"POST"}),users:()=>l("/api/users"),createUser:e=>l("/api/users",{method:"POST",body:JSON.stringify(e)}),updateUser:(e,a)=>l(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(a)}),resetPassword:(e,a)=>l(`/api/users/${e}/reset-password`,{method:"POST",body:JSON.stringify({password:a})}),projects:()=>l("/api/projects"),createProject:e=>l("/api/projects",{method:"POST",body:JSON.stringify(e)}),updateProject:(e,a)=>l(`/api/projects/${e}`,{method:"PATCH",body:JSON.stringify(a)}),activateProject:e=>l(`/api/projects/${e}/activate`,{method:"POST"}),deactivateProject:e=>l(`/api/projects/${e}/deactivate`,{method:"POST"}),deleteProject:e=>l(`/api/projects/${e}`,{method:"DELETE"}),publishZip:(e,a)=>F(`/api/projects/${e}/publish/zip`,a),publishHtml:(e,a)=>F(`/api/projects/${e}/publish/html`,a),publishFolder:(e,a)=>H(`/api/projects/${e}/publish/folder`,a),packageExeUrl:e=>`/api/projects/${e}/packages/exe`,versions:e=>l(`/api/projects/${e}/versions`),activateVersion:(e,a)=>l(`/api/projects/${e}/versions/${a}/activate`,{method:"POST"}),files:(e,a)=>l(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`),putFile:(e,a,s)=>fetch(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`,{method:"PUT",body:s,credentials:"same-origin"}).then(async n=>{const i=await n.json();if(!n.ok)throw new Error(i.error||"上传失败");return i}),deleteFile:(e,a)=>l(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`,{method:"DELETE"}),shareKey:e=>l(`/api/projects/${e}/share-key`,{method:"POST"}),publicHost:()=>l("/api/system/public-host"),updatePublicHost:e=>l("/api/system/public-host",{method:"PATCH",body:JSON.stringify({publicHost:e})}),networkSettings:()=>l("/api/system/network"),updateNetworkSettings:e=>l("/api/system/network",{method:"PATCH",body:JSON.stringify(e)})},t={me:null,users:[],projects:[],selectedId:null,versions:[],files:[],publicHostInfo:null,networkSettings:null,filePath:"",activeView:"projects",activeProjectTab:"overview",projectSearch:"",projectShareFilter:"all",createModalOpen:!1,accountModalOpen:!1,accountModalFocus:"email",userSearch:"",userModal:null,message:"",error:"",shareUrl:""},f=document.querySelector("#app"),I="/admin/icons/webshare-logo.svg",N="/admin/icons/webshare-icon.svg";async function C(){try{const{user:e}=await r.me();t.me=e,await p()}catch{t.me=null}u()}async function p(){if(!t.me)return;const e=t.me.role==="admin";(t.activeView==="users"||t.activeView==="share")&&!e&&(t.activeView="projects");const[{projects:a}]=await Promise.all([r.projects(),e?A():Promise.resolve()]);t.projects=a??[],(!t.selectedId||!t.projects.some(s=>s.id===t.selectedId))&&(t.selectedId=t.projects[0]?.id??null),await k()}async function h(){const{users:e}=await r.users();t.users=e??[]}async function A(){await Promise.all([h(),O(),z()])}async function O(){t.publicHostInfo=await r.publicHost()}async function z(){const{network:e}=await r.networkSettings();t.networkSettings=e}async function k(){const e=v();if(!e||!e.currentVersionId){t.versions=[],t.files=[];return}const[{versions:a},{files:s}]=await Promise.all([r.versions(e.id),r.files(e.id,t.filePath)]);t.versions=a??[],t.files=s??[]}function v(){return t.projects.find(e=>e.id===t.selectedId)||null}function D(){const e=t.projectSearch.trim().toLowerCase();return t.projects.filter(a=>{const s=!e||a.name.toLowerCase().includes(e)||a.slug.toLowerCase().includes(e),n=t.projectShareFilter==="all"||a.shareState===t.projectShareFilter;return s&&n})}function R(){const e=t.userSearch.trim().toLowerCase();return e?t.users.filter(a=>a.username.toLowerCase().includes(e)||(a.email||"").toLowerCase().includes(e)||E(a.role).toLowerCase().includes(e)):t.users}function u(){f.innerHTML=t.me?Z():B(),ve()}function B(){return`
    <main class="login-shell">
      <section class="login-frame" aria-label="WebShare 登录">
        <div class="login-visual" aria-hidden="true">
          <div class="login-visual-surface">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <img class="login-visual-icon" src="${N}" alt="" />
        </div>
        <form class="login-panel" data-form="login">
          <div class="login-brand">
            <img class="brand-logo large" src="${I}" alt="WebShare" />
            <div>
              <h1>登录 WebShare</h1>
              <p>内部管理控制台</p>
            </div>
          </div>
          ${w()}
          <div class="login-fields">
            <label class="login-field">用户名 / 邮箱<input name="username" autocomplete="username" required autofocus /></label>
            <label class="login-field">密码<input name="password" type="password" autocomplete="current-password" required /></label>
          </div>
          <button class="primary block login-submit" type="submit">登录</button>
        </form>
      </section>
    </main>
  `}function Z(){const e=t.activeView==="projects";return`
    <main class="console-shell ${e?"":"single-workspace"}">
      ${W()}
      ${e?X():""}
      <section class="workspace">
        ${J()}
      </section>
      ${t.createModalOpen&&e?_():""}
      ${t.accountModalOpen?K():""}
      ${t.userModal&&t.activeView==="users"?ue():""}
    </main>
  `}function J(){return t.activeView==="users"?le():t.activeView==="share"?pe():Q()}function W(){const e=t.me;return`
    <aside class="global-nav">
      <div class="brand">
        <img class="brand-logo compact" src="${I}" alt="WebShare" />
      </div>
      <nav class="nav-stack">
        <button class="nav-item ${t.activeView==="projects"?"active":""}" data-action="set-view" data-view="projects">
          <span>项目</span><b>${t.projects.length}</b>
        </button>
        ${e.role==="admin"?`<button class="nav-item ${t.activeView==="share"?"active":""}" data-action="set-view" data-view="share">
                <span>分享地址</span><b>IP</b>
              </button>
              <button class="nav-item ${t.activeView==="users"?"active":""}" data-action="set-view" data-view="users">
                <span>用户</span><b>${t.users.length}</b>
              </button>`:""}
      </nav>
      <div class="account-box">
        <div>
          <strong>${o(e.username)}</strong>
          <span>${E(e.role)}${e.email?` · ${o(e.email)}`:""}</span>
        </div>
        <div class="account-actions">
          <button data-action="open-account-modal">账号设置</button>
          <button data-action="logout">退出</button>
        </div>
      </div>
    </aside>
  `}function K(){const e=t.me,a=t.accountModalFocus==="email"?"autofocus":"",s=t.accountModalFocus==="password"?"autofocus":"",n=`
    <form class="modal-form" data-form="account-email">
      <label>邮箱<input name="email" type="email" value="${d(e.email||"")}" placeholder="name@example.com" ${a} /></label>
      <div class="modal-actions">
        <button class="primary" type="submit">保存邮箱</button>
      </div>
    </form>
  `,i=`
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
            <h2>${o(e.username)}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-account-modal">关闭</button>
        </div>
        <div class="account-modal-tabs">
          <button class="${t.accountModalFocus==="email"?"active":""}" type="button" data-action="set-account-focus" data-focus="email">修改邮箱</button>
          <button class="${t.accountModalFocus==="password"?"active":""}" type="button" data-action="set-account-focus" data-focus="password">修改密码</button>
        </div>
        ${w()}
        ${t.accountModalFocus==="password"?i:n}
      </section>
    </div>
  `}function X(){const e=D();return`
    <aside class="project-column">
      <div class="column-head">
        <div>
          <h2>项目</h2>
          <span class="muted project-count">${e.length} / ${t.projects.length}</span>
        </div>
        <button class="primary" data-action="open-create-modal">新建</button>
      </div>
      <div class="project-filters">
        <input data-input="project-search" value="${d(t.projectSearch)}" placeholder="搜索项目名称或标识" />
        <select data-change="share-filter">
          ${m("all","全部状态",t.projectShareFilter)}
          ${m("public","公开",t.projectShareFilter)}
          ${m("share","密钥分享",t.projectShareFilter)}
          ${m("unshared","不分享",t.projectShareFilter)}
        </select>
      </div>
      <div class="project-list">${e.map(G).join("")||'<p class="empty">没有匹配项目</p>'}</div>
    </aside>
  `}function _(){return`
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
  `}function G(e){return`
    <button class="project-item ${e.id===t.selectedId?"active":""}" data-action="select-project" data-id="${e.id}">
      <span class="project-name">${o(e.name)}</span>
      <span class="project-meta">
        <b>${o(e.slug)}</b>
        <em>${$(e.accessMode)}</em>
      </span>
      <span class="mini-pills">
        <i class="${e.active?"enabled":"disabled"}">${T(e.active)}</i>
        <i class="${e.shareState}">${y(e.shareState)}</i>
        <i>${e.currentVersionId?"已发布":"未发布"}</i>
      </span>
    </button>
  `}function Q(){const e=v();return e?`
    <div class="workspace-stack">
      ${w()}
      ${Y(e)}
      ${ee(e)}
      ${ae(e)}
    </div>
  `:fe()}function Y(e){return`
    <section class="hero-panel">
      <div class="hero-main">
        <div class="status-row">
          <span class="pill ${e.active?"enabled":"disabled"}">${T(e.active)}</span>
          <span class="pill">${$(e.accessMode)}</span>
          <span class="pill ${e.shareState}">${y(e.shareState)}</span>
          <span class="pill">${e.spaEnabled?"SPA fallback":"普通静态"}</span>
        </div>
        <h1>${o(e.name)}</h1>
        <div class="slug-line">${o(e.slug)}</div>
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
        ${e.active?`<a href="${d(e.accessUrl)}" target="_blank" rel="noreferrer">${o(e.accessUrl)}</a>`:`<code>${o(e.accessUrl)}</code>`}
      </div>
      ${t.shareUrl?`<div class="access-strip key"><span>密钥链接</span><code>${o(t.shareUrl)}</code></div>`:""}
      <div class="summary-grid">
        ${g("BaseURL",e.detectedBaseUrl||"未识别")}
        ${g("入口文件",e.entryFile||"index.html")}
        ${g("挂载路径",e.mountPath||"-")}
        ${g("端口",e.port?String(e.port):"-")}
        ${g("运行状态",T(e.active))}
      </div>
    </section>
  `}function ee(e){return`
    <div class="tabs">
      ${[["overview","概览"],["publish","发布"],["files","文件"],["versions",`版本 ${t.versions.length}`],["settings","设置"]].map(([s,n])=>`<button class="${t.activeProjectTab===s?"active":""}" data-action="set-tab" data-tab="${s}">${n}</button>`).join("")}
      <button class="ghost danger" data-action="delete-project" data-id="${e.id}">删除项目</button>
    </div>
  `}function ae(e){switch(t.activeProjectTab){case"publish":return se(e);case"files":return ne(e);case"versions":return re(e);case"settings":return oe(e);default:return te(e)}}function te(e){return`
    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <h3>运行状态</h3>
          <span>${e.active?e.currentVersionId?"已发布":"等待发布":"已停用"}</span>
        </div>
        ${he(e.warnings)}
        ${e.active?e.currentVersionId?`<div class="status-card success">
                <strong>当前项目可访问</strong>
                <span>访问模式为 ${$(e.accessMode)}，分享状态为 ${y(e.shareState)}。</span>
              </div>`:`<div class="status-card">
                <strong>还没有发布版本</strong>
                <span>上传 ZIP、文件夹构建产物或单 HTML 文件后，系统会识别 BaseURL 并生成访问地址。</span>
                <button class="primary" data-action="set-tab" data-tab="publish">去发布</button>
              </div>`:`<div class="status-card">
                <strong>项目已停用</strong>
                <span>访问模式为 ${$(e.accessMode)}，分享状态为 ${y(e.shareState)}。</span>
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
          <button data-action="set-tab" data-tab="versions" ${t.versions.length?"":"disabled"}>查看版本</button>
          ${e.currentVersionId?`<a class="button-link" href="${d(r.packageExeUrl(e.id))}">下载 EXE</a>`:"<button disabled>下载 EXE</button>"}
          <button data-action="set-tab" data-tab="settings">调整设置</button>
        </div>
      </div>
    </section>
  `}function se(e){return`
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
  `}function ne(e){const a=t.filePath.split("/").filter(Boolean).slice(0,-1).join("/");return e.currentVersionId?`
    <section class="panel">
      <div class="panel-head">
        <h3>文件管理</h3>
        <span>${t.files.length} 项</span>
      </div>
      <div class="pathbar">
        <button data-action="open-path" data-path="">根目录</button>
        ${t.filePath?`<button data-action="open-path" data-path="${d(a)}">上级</button>`:""}
        <code>/${o(t.filePath)}</code>
      </div>
      <form class="file-upload" data-form="file">
        <input name="path" placeholder="保存路径，例如 assets/logo.png" required />
        <input name="file" type="file" required />
        <button class="primary" type="submit">上传/替换</button>
      </form>
      <div class="table-list file-table">
        ${t.files.map(ie).join("")||'<p class="empty">空目录</p>'}
      </div>
    </section>
  `:`<section class="panel">${M("当前项目还没有版本，发布后才能管理文件。")}</section>`}function ie(e){return`
    <div class="table-row">
      <button class="file-cell" data-action="${e.isDir?"open-path":"noop"}" data-path="${d(e.path)}">
        <span class="file-badge">${e.isDir?"DIR":"FILE"}</span>
        <span>${o(e.name)}</span>
      </button>
      <span>${e.isDir?"目录":S(e.size)}</span>
      <button class="ghost danger" data-action="delete-file" data-path="${d(e.path)}">删除</button>
    </div>
  `}function re(e){return`
    <section class="panel">
      <div class="panel-head">
        <h3>版本历史</h3>
        <span>${t.versions.length} 条</span>
      </div>
      <div class="table-list">
        ${t.versions.map(a=>`
              <div class="table-row">
                <div>
                  <strong>#${a.versionNumber}</strong>
                  <span>${o(a.sourceType)} · ${S(a.sizeBytes)} · ${x(a.createdAt)}</span>
                </div>
                <span>${o(a.detectedBaseUrl||"未识别")}</span>
                <button data-action="activate-version" data-version="${a.id}" ${a.id===e.currentVersionId?"disabled":""}>激活</button>
              </div>`).join("")||'<p class="empty">暂无版本</p>'}
      </div>
    </section>
  `}function oe(e){return`
    <form class="panel" data-form="settings">
      <div class="panel-head">
        <h3>项目设置</h3>
        <span>低频配置</span>
      </div>
      <div class="field-grid">
        <label>名称<input name="name" value="${d(e.name)}" /></label>
        <label>项目标识<input name="slug" value="${d(e.slug)}" /></label>
        <label>入口文件<input name="entryFile" value="${d(e.entryFile)}" /></label>
        <label>挂载路径<input name="mountPath" value="${d(e.mountPath)}" placeholder="/demo/" /></label>
        <label>访问模式
          <select name="accessMode">
            ${m("path","路径",e.accessMode)}
            ${m("mount","挂载路径",e.accessMode)}
            ${m("port","独立端口",e.accessMode)}
          </select>
        </label>
        <label>分享状态
          <select name="shareState">
            ${m("public","公开",e.shareState)}
            ${m("share","密钥分享",e.shareState)}
            ${m("unshared","不分享",e.shareState)}
          </select>
        </label>
      </div>
      <label class="check"><input name="spaEnabled" type="checkbox" ${e.spaEnabled?"checked":""} /> SPA fallback</label>
      <div class="form-actions">
        <button class="primary" type="submit">保存设置</button>
      </div>
    </form>
  `}function le(){if(t.me?.role!=="admin")return`<section class="panel">${M("需要管理员权限。")}</section>`;const e=R();return`
    <div class="workspace-stack">
      ${w()}
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
          <span>${e.length} / ${t.users.length} 个账号</span>
        </div>
        <div class="user-toolbar">
          <input data-input="user-search" value="${d(t.userSearch)}" placeholder="搜索用户名、邮箱或角色" />
        </div>
        ${e.length?ce(e):'<p class="empty">没有匹配用户</p>'}
      </section>
    </div>
  `}function ce(e){return`
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
          ${e.map((a,s)=>de(a,s)).join("")}
        </tbody>
      </table>
    </div>
  `}function de(e,a){const s=e.id===t.me?.id,n=!e.disabled;return`
    <tr>
      <td>${a+1}</td>
      <td><strong>${o(e.username)}</strong></td>
      <td>${e.email?o(e.email):'<span class="muted">未设置</span>'}</td>
      <td>${E(e.role)}</td>
      <td><span class="state-badge ${e.disabled?"disabled":"enabled"}">${e.disabled?"已禁用":"启用中"}</span></td>
      <td>${x(e.createdAt)}</td>
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
  `}function ue(){const e=t.userModal,a=e.userId?t.users.find(i=>i.id===e.userId):null;if(e.mode!=="create"&&!a)return"";if(e.mode==="reset"&&a)return`
      <div class="modal-backdrop" role="presentation">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-label="重置密码">
          <div class="modal-head">
            <div>
              <span class="eyebrow">重置密码</span>
              <h2>${o(a.username)}</h2>
            </div>
            <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
          </div>
          <form class="modal-form" data-form="user-reset" data-user-id="${a.id}">
            <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="8" required autofocus /></label>
            <div class="modal-actions">
              <button type="button" data-action="close-user-modal">取消</button>
              <button class="primary" type="submit">保存密码</button>
            </div>
          </form>
        </section>
      </div>
    `;const s=e.mode==="edit"&&!!a,n=a||null;return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="${s?"编辑用户":"创建用户"}">
        <div class="modal-head">
          <div>
            <span class="eyebrow">${s?"编辑用户":"创建用户"}</span>
            <h2>${s&&n?o(n.username):"新增账号"}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="${s?"user-edit":"user-create"}" ${s&&n?`data-user-id="${n.id}"`:""}>
          <label>用户名<input name="username" value="${d(n?.username||"")}" minlength="3" required autofocus /></label>
          <label>邮箱<input name="email" type="email" value="${d(n?.email||"")}" placeholder="name@example.com" ${s?"":"required"} /></label>
          ${s?"":'<label>初始密码<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>'}
          <label>角色
            <select name="role">
              ${m("user","用户",n?.role||"user")}
              ${m("admin","管理员",n?.role||"user")}
            </select>
          </label>
          ${s?`<label class="check"><input name="disabled" type="checkbox" ${n?.disabled?"checked":""} ${n?.id===t.me?.id?"disabled":""} /> 禁用账号</label>`:""}
          <div class="modal-actions">
            <button type="button" data-action="close-user-modal">取消</button>
            <button class="primary" type="submit">${s?"保存用户":"创建用户"}</button>
          </div>
        </form>
      </section>
    </div>
  `}function pe(){if(t.me?.role!=="admin")return`<section class="panel">${M("需要管理员权限。")}</section>`;const e=t.publicHostInfo?.publicHost||"未设置",a=t.networkSettings,s=a?.activeSharePort??8081,n=a?`${a.activePortStart}-${a.activePortEnd}`:"12000-12999";return`
    <div class="workspace-stack">
      ${w()}
      <section class="view-head">
        <div>
          <span class="eyebrow">分享地址</span>
          <h1>访问网络配置</h1>
        </div>
        <span>只有管理员可以修改项目访问地址使用的主机和端口。</span>
      </section>
      <section class="panel">
        ${me()}
      </section>
      <section class="panel">
        ${be()}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>地址生成规则</h3>
          <span>当前主机：${o(e)}</span>
        </div>
        <div class="info-list">
          <div><strong>管理后台</strong><span>继续使用 8080 端口，不受分享地址设置影响。</span></div>
          <div><strong>路径分享</strong><span>项目地址会按当前主机和 ${s} 分享端口生成。</span></div>
          <div><strong>独立端口</strong><span>端口模式项目会从 ${n} 中分配端口。</span></div>
        </div>
      </section>
    </div>
  `}function me(){const e=t.publicHostInfo,a=e?.candidates??[],s=e?.publicHost??"",n=t.networkSettings?.activeSharePort??8081,i=s||"未设置",c=s?`${window.location.protocol}//${He(s)}:${n}/`:"未设置";return`
    <div class="address-layout">
      <div class="address-current">
        <span class="eyebrow">当前地址</span>
        <h3>分享网关地址</h3>
        <code class="current-address">${o(c)}</code>
        <div class="address-meta">
          <div><strong>当前主机</strong><span>${o(i)}</span></div>
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
            ${a.map(b=>m(b,b,s)).join("")}
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
  `}function be(){const e=t.networkSettings,a=e?.sharePort??8081,s=e?.portStart??12e3,n=e?.portEnd??12999,i=e?`${e.activePortStart}-${e.activePortEnd}`:"12000-12999";return`
    <form class="network-form" data-form="network-settings">
      <div class="panel-head compact">
        <div>
          <h3>端口配置</h3>
          <span>保存后重启软件生效。</span>
        </div>
        ${e?.restartRequired?'<span class="restart-badge">待重启</span>':'<span class="restart-badge ready">已生效</span>'}
      </div>
      <div class="network-grid">
        <label>分享网关端口<input name="sharePort" type="number" min="1" max="65535" value="${a}" required /></label>
        <label>独立端口起点<input name="portStart" type="number" min="1" max="65535" value="${s}" required /></label>
        <label>独立端口终点<input name="portEnd" type="number" min="1" max="65535" value="${n}" required /></label>
      </div>
      <div class="runtime-strip">
        <span>当前运行：分享网关 ${e?.activeSharePort??8081}，独立端口 ${i}</span>
      </div>
      <div class="form-actions">
        <button class="primary" type="submit">保存端口配置</button>
      </div>
    </form>
  `}function fe(){return`
    <section class="empty-state">
      <h2>还没有项目</h2>
      <p>在中栏创建项目后，上传 ZIP、文件夹或 HTML 即可获得访问地址。</p>
    </section>
  `}function M(e){return`<div class="inline-empty">${o(e)}</div>`}function he(e){const a=e??[];return a.length?`<ul class="warnings">${a.map(s=>`<li>${o(s)}</li>`).join("")}</ul>`:""}function w(){return`${t.error?`<div class="notice error">${o(t.error)}</div>`:""}${t.message?`<div class="notice">${o(t.message)}</div>`:""}`}function ve(){f.querySelectorAll("form").forEach(e=>e.addEventListener("submit",ye)),f.querySelectorAll("[data-action]").forEach(e=>e.addEventListener("click",Se)),f.querySelectorAll("input[data-file]").forEach(e=>e.addEventListener("change",j)),f.querySelectorAll("input[data-create-file]").forEach(e=>e.addEventListener("change",j)),f.querySelector('[data-input="project-search"]')?.addEventListener("input",ge),f.querySelector('[data-input="user-search"]')?.addEventListener("input",we),f.querySelector('[data-change="share-filter"]')?.addEventListener("change",$e)}function ge(e){t.projectSearch=e.currentTarget.value,u()}function we(e){t.userSearch=e.currentTarget.value,u()}function $e(e){t.projectShareFilter=e.currentTarget.value,u()}function j(e){const a=e.currentTarget,s=a.dataset.file||a.dataset.createFile;a.dataset.createFile&&Ue(a);const i=a.closest(".upload-box")?.querySelector("[data-upload-summary]");i&&(i.textContent=U(s,a))}async function ye(e){e.preventDefault();const a=e.currentTarget,s=new FormData(a);await L(async()=>{switch(a.dataset.form){case"login":{const{user:n}=await r.login(String(s.get("username")),String(s.get("password")));t.me=n,t.activeView="projects",await p();break}case"project":{const n=ke(a),{project:i}=await r.createProject({name:String(s.get("name"))});t.selectedId=i.id,t.activeProjectTab="overview",t.createModalOpen=!1,await p(),n&&await Te(i.id,n),await p();break}case"settings":await Pe(a);break;case"account-email":await Ee(a);break;case"account-password":await Fe(a);break;case"file":await Me(a);break;case"user-create":await r.createUser({username:String(s.get("username")),email:String(s.get("email")),password:String(s.get("password")),role:String(s.get("role"))}),t.userModal=null,await h();break;case"user-edit":await je(a);break;case"user-reset":await Ie(a);break;case"public-host":{const n=String(s.get("customHost")||"").trim(),i=String(s.get("publicHost")||"").trim();await r.updatePublicHost(n||i),await p();break}case"network-settings":{const{network:n}=await r.updateNetworkSettings({sharePort:Number(s.get("sharePort")),portStart:Number(s.get("portStart")),portEnd:Number(s.get("portEnd"))});t.networkSettings=n,t.message=n.restartRequired?"端口配置已保存，重启软件后生效":"端口配置已保存",await p();break}}})}async function Se(e){const a=e.currentTarget,s=a.dataset.action;if(s!=="noop"){if(s==="set-view"){const n=a.dataset.view||"projects";t.activeView=t.me?.role==="admin"||n==="projects"?n:"projects",t.createModalOpen=!1,t.accountModalOpen=!1,t.userModal=null,t.error="",t.message="";try{t.activeView==="users"&&await h(),t.activeView==="share"&&await O()}catch(i){t.error=i instanceof Error?i.message:"加载视图失败"}u();return}if(s==="set-tab"){t.activeProjectTab=a.dataset.tab||"overview",t.error="",t.message="",u();return}if(s==="select-project"){t.selectedId=Number(a.dataset.id),t.filePath="",t.shareUrl="",t.activeProjectTab="overview",t.error="",t.message="",await k(),u();return}if(s==="open-path"){t.filePath=a.dataset.path||"",t.error="",t.message="",await k(),u();return}if(s==="open-create-modal"){t.createModalOpen=!0,t.accountModalOpen=!1,t.error="",t.message="",u();return}if(s==="close-create-modal"){t.createModalOpen=!1,t.error="",t.message="",u();return}if(s==="open-account-modal"){t.accountModalOpen=!0,t.accountModalFocus="email",t.createModalOpen=!1,t.userModal=null,t.error="",t.message="",u();return}if(s==="set-account-focus"){t.accountModalFocus=a.dataset.focus||"email",t.error="",t.message="",u();return}if(s==="close-account-modal"){t.accountModalOpen=!1,t.error="",t.message="",u();return}if(s==="open-user-modal"){t.userModal={mode:a.dataset.mode||"create",userId:Number(a.dataset.id)||void 0},t.accountModalOpen=!1,t.error="",t.message="",u();return}if(s==="close-user-modal"){t.userModal=null,t.error="",t.message="",u();return}await L(async()=>{const n=v();switch(s){case"logout":await r.logout(),t.me=null,t.accountModalOpen=!1,t.activeView="projects",t.selectedId=null;break;case"copy-link":await Le(a.dataset.url||""),t.message="访问地址已复制";break;case"publish-zip":await P("zip");break;case"publish-folder":await P("folder");break;case"publish-html":await P("html");break;case"share-key":if(n){const i=await r.shareKey(n.id);t.shareUrl=i.shareUrl,t.message="分享密钥已生成",await p()}break;case"activate-project":n&&(await r.activateProject(n.id),await p());break;case"deactivate-project":n&&confirm("确认停用该项目？")&&(await r.deactivateProject(n.id),await p());break;case"activate-version":n&&await r.activateVersion(n.id,Number(a.dataset.version)),t.activeProjectTab="overview",await p();break;case"delete-file":n&&confirm("确认删除该路径？")&&(await r.deleteFile(n.id,a.dataset.path||""),await p());break;case"delete-project":n&&confirm("确认删除该项目？")&&(await r.deleteProject(n.id),t.selectedId=null,await p());break;case"toggle-user":await Oe(Number(a.dataset.id),a.dataset.disabled==="true");break}})}}async function Pe(e){const a=v();if(!a)return;const s=new FormData(e);await r.updateProject(a.id,{name:String(s.get("name")),slug:String(s.get("slug")),entryFile:String(s.get("entryFile")),mountPath:String(s.get("mountPath")),accessMode:String(s.get("accessMode")),shareState:String(s.get("shareState")),spaEnabled:!!s.get("spaEnabled")}),t.activeProjectTab="overview",await p()}function ke(e){const a=e.querySelector('input[data-create-file="zip"]')?.files?.[0];if(a&&a.size>0){if(!a.name.toLowerCase().endsWith(".zip"))throw new Error("创建时 ZIP 发布只支持 .zip 文件");return{kind:"zip",file:a}}const s=e.querySelector('input[data-create-file="folder"]')?.files;if(s?.length)return{kind:"folder",files:s};const n=e.querySelector('input[data-create-file="html"]')?.files?.[0];if(n&&n.size>0){const i=n.name.toLowerCase();if(!i.endsWith(".html")&&!i.endsWith(".htm"))throw new Error("创建时 HTML 发布只支持 .html 或 .htm 文件");return{kind:"html",file:n}}return null}async function Te(e,a){if(a.kind==="folder"){if(!a.files?.length)throw new Error("请选择文件夹");await r.publishFolder(e,a.files);return}if(!a.file)throw new Error("请选择文件");a.kind==="zip"?await r.publishZip(e,a.file):await r.publishHtml(e,a.file)}async function P(e){const a=v();if(!a)return;const s=f.querySelector(`input[data-file="${e}"]`);if(e==="folder"){const n=s?.files;if(!n?.length)throw new Error("请选择文件夹");await r.publishFolder(a.id,n)}else{const n=s?.files?.[0];if(!n)throw new Error("请选择文件");e==="zip"?await r.publishZip(a.id,n):await r.publishHtml(a.id,n)}t.activeProjectTab="overview",await p()}async function Me(e){const a=v();if(!a)return;const s=new FormData(e),n=s.get("file");if(!(n instanceof File))throw new Error("请选择文件");await r.putFile(a.id,String(s.get("path")),n),await p(),t.activeProjectTab="files"}async function Ee(e){const a=String(new FormData(e).get("email")||""),{user:s}=await r.updateMe({email:a});t.me=s,s.role==="admin"&&await h(),t.message="邮箱已保存"}async function Fe(e){const a=new FormData(e);await r.changeOwnPassword(String(a.get("currentPassword")),String(a.get("newPassword"))),t.message="密码已修改"}async function je(e){const a=Number(e.dataset.userId),s=t.users.find(b=>b.id===a);if(!s)throw new Error("用户不存在");const n=new FormData(e),i=s.id===t.me?.id?!1:!!n.get("disabled"),{user:c}=await r.updateUser(a,{username:String(n.get("username")),email:String(n.get("email")),role:String(n.get("role")),disabled:i});t.me?.id===c.id&&(t.me=c),t.userModal=null,await h()}async function Ie(e){const a=Number(e.dataset.userId),s=String(new FormData(e).get("password"));await r.resetPassword(a,s),t.userModal=null,await h()}async function Oe(e,a){const s=t.users.find(n=>n.id===e);if(!s)throw new Error("用户不存在");await r.updateUser(e,{username:s.username,email:s.email||"",role:s.role,disabled:a}),await h()}async function L(e){t.error="",t.message="";try{await e(),t.message||(t.message="操作完成")}catch(a){t.error=a instanceof Error?a.message:"操作失败"}u()}async function Le(e){if(!e)throw new Error("没有可复制的地址");if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(e);return}const a=document.createElement("textarea");a.value=e,a.style.position="fixed",a.style.opacity="0",document.body.appendChild(a),a.select(),document.execCommand("copy"),a.remove()}function g(e,a){return`<div class="summary-item"><span>${o(e)}</span><strong>${o(a)}</strong></div>`}function m(e,a,s){return`<option value="${e}" ${e===s?"selected":""}>${a}</option>`}function E(e){return e==="admin"?"管理员":"用户"}function T(e){return e?"运行中":"已停用"}function $(e){return{path:"路径",mount:"挂载",port:"端口"}[e]||e}function y(e){return{public:"公开",share:"密钥分享",unshared:"不分享"}[e]||e}function S(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function U(e,a){const s=Array.from(a.files??[]);if(!s.length)return e==="folder"?"未选择文件夹":"未选择文件";if(e!=="folder")return`${s[0].name} · ${S(s[0].size)}`;const n=s.reduce((i,c)=>i+c.size,0);return`${xe(s)} · ${s.length} 个文件 · ${S(n)}`}function Ue(e){e.closest("form")?.querySelectorAll("input[data-create-file]").forEach(s=>{if(s===e)return;s.value="";const n=s.dataset.createFile,i=s.closest(".upload-box")?.querySelector("[data-upload-summary]");i&&(i.textContent=U(n,s))})}function xe(e){return(e[0].webkitRelativePath||"").replaceAll("\\","/").split("/").filter(Boolean)[0]||"已选文件夹"}function x(e){return e?new Date(e).toLocaleString("zh-CN",{hour12:!1}):"-"}function o(e){return String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function d(e){return o(e||"")}function He(e){return e.includes(":")&&!e.startsWith("[")?`[${e}]`:e}C();
