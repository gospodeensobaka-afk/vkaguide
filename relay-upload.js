/* One-time preparation. Only VK API through Bridge; binary upload to VK's returned URL. */
(() => {
  'use strict';
  const R=window.Relay, STORE='relay-photo-urls-v1';
  let photoToken, denied=false, running=false;
  const page=R.shell('relayUpload','<div class="relay-card"><button class="relay-back">← К пульту</button><h1>Подготовка 173 фото</h1><p>Сначала попробуйте восстановить ссылки уже загруженных фото. Затем выберите все JPG из папки photo-originals: загрузятся только фотографии без ссылок. Посты и сообщения не публикуются.</p><button id="relayResolve">1. Получить старые ссылки ВК</button><label for="relayFiles"><p>Оригиналы ретранслятора</p></label><input id="relayFiles" type="file" accept="image/jpeg" multiple><button id="relayUploadMissing">2. Загрузить недостающие фото</button><div class="relay-status" role="status" aria-live="polite"></div><button id="relayExport">3. Скачать relay-photos.js</button><p>Замените этим файлом relay-photos.js в ОБОИХ репозиториях. Если скачивание недоступно, скопируйте текст ниже в файл с этим именем.</p><textarea readonly aria-label="Содержимое relay-photos.js"></textarea></div>');
  const status=page.querySelector('.relay-status'), output=page.querySelector('textarea');
  const desktopButton=document.createElement('button');
  desktopButton.id='relayDesktopToken';
  desktopButton.textContent='Токен для PowerShell';
  page.querySelector('.relay-card').insertBefore(desktopButton, page.querySelector('#relayResolve'));
  desktopButton.onclick=async()=>{
    if(running)return;
    lock(true);
    try{
      const value=await token();
      try{await vkBridge.send('VKWebAppCopyText',{text:value});}
      catch(_){await navigator.clipboard.writeText(value);}
      status.textContent='Токен скопирован. Вставьте его только в скрытый ввод UPLOAD-PHOTOS.ps1 на своём ноутбуке. В чат и GitHub токен не отправляйте. После ввода скопируйте любой обычный текст, чтобы заменить содержимое буфера.';
    }catch(_){status.textContent='Не удалось получить или скопировать токен. Откройте пульт внутри ВК на ноутбуке и разрешите доступ к фотографиям. Если ошибка повторится — сообщите об этом, токен не присылайте.';}
    finally{lock(false);}
  };

  // Only public CDN URLs are persisted. Never tokens.
  try{const cached=JSON.parse(localStorage.getItem(STORE)||'{}');for(const p of R.photos){const c=cached[p.id];if(c && !R.allowedURL(p.url) && R.allowedURL(c.url)){p.url=c.url;p.thumb=R.allowedURL(c.thumb)?c.thumb:c.url;}}}catch(_){}
  const count=()=>R.photos.filter(p=>R.allowedURL(p.url)).length;
  function exportText(){return '/* Public VK photo URLs. No tokens. */\nwindow.RELAY_PHOTOS = '+JSON.stringify(R.photos,null,2)+';\n';}
  function save(){
    const cache={};for(const p of R.photos)if(R.allowedURL(p.url))cache[p.id]={url:p.url,thumb:p.thumb};
    try{localStorage.setItem(STORE,JSON.stringify(cache));}catch(_){}
    output.value=exportText();window.RelayGuide?.redraw();
  }
  function lock(value){running=value;page.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
  async function token(){
    if(denied)throw {auth:true};if(photoToken)return photoToken;
    try{const r=await vkBridge.send('VKWebAppGetAuthToken',{app_id:R.appId,scope:'photos'});if(!r.access_token)throw new Error();return photoToken=r.access_token;}
    catch(_){denied=true;throw {auth:true};}
  }
  function sizes(p,photo){
    const all=(photo?.sizes||[]).filter(s=>R.allowedURL(s.url)&&s.width>0&&s.height>0);
    if(!all.length)return false;
    const bounded=all.filter(s=>Math.max(s.width,s.height)<=1280);
    const large=(bounded.length?bounded:all).slice().sort((a,b)=>bounded.length?(b.width*b.height-a.width*a.height):(a.width*a.height-b.width*b.height))[0];
    const thumb=all.slice().sort((a,b)=>Math.abs(Math.max(a.width,a.height)-180)-Math.abs(Math.max(b.width,b.height)-180))[0];
    p.url=large.url;p.thumb=thumb.url;return true;
  }
  const delay=()=>new Promise(resolve=>setTimeout(resolve,400));
  page.querySelector('#relayResolve').onclick=async()=>{
    if(running)return;lock(true);
    try{
      const t=await token(), pending=R.photos.filter(p=>p.vk&&!R.allowedURL(p.url));
      for(let i=0;i<pending.length;i+=50){
        status.textContent=`Восстанавливаю ссылки: ${i}/${pending.length}…`;
        const batch=pending.slice(i,i+50);
        const result=await R.api('photos.getById',{photos:batch.map(p=>p.vk.replace(/^photo/,'')).join(','),photo_sizes:1},t);
        if(!Array.isArray(result))throw new Error('Bad photo list');
        for(const photo of result){const id=`photo${photo.owner_id}_${photo.id}`;for(const p of batch)if(p.vk===id)sizes(p,photo);}
        save();await delay();
      }
      status.textContent=`Ссылки готовы: ${count()}/${R.photos.length}. Остальные загрузите из оригиналов. Проверьте миниатюры в пульте.`;
    }catch(e){status.textContent=R.errorText(e)+' Старые ссылки не восстановлены полностью. Сохранённые результаты не потеряны.';}
    finally{lock(false);save();}
  };
  page.querySelector('#relayUploadMissing').onclick=async()=>{
    if(running)return;
    const files=new Map([...page.querySelector('input').files].map(f=>[f.name,f]));
    const pending=R.photos.filter(p=>!R.allowedURL(p.url));
    const missing=pending.filter(p=>!files.has(p.file));
    if(missing.length){status.textContent=`Выберите все оригиналы из photo-originals. Не выбрано нужных файлов: ${missing.length}.`;return;}
    lock(true);
    try{
      const t=await token();
      for(let i=0;i<pending.length;i++){
        const p=pending[i];status.textContent=`Загружаю ${i+1}/${pending.length}: ${p.title}`;
        const server=await R.api('photos.getWallUploadServer',{},t);
        if(!R.allowedURL(server?.upload_url))throw new Error('Invalid upload host');
        const body=new FormData();body.append('photo',files.get(p.file),p.file);
        const response=await fetch(server.upload_url,{method:'POST',body,credentials:'omit'});
        if(!response.ok)throw new Error('Upload failed');
        const data=await response.json();
        const saved=await R.api('photos.saveWallPhoto',{server:data.server,photo:data.photo,hash:data.hash},t);
        if(!sizes(p,saved?.[0]))throw new Error('No image');
        p.vk=`photo${saved[0].owner_id}_${saved[0].id}`;save();await delay();
      }
      status.textContent=`Готово ${count()}/${R.photos.length}. Скачайте файл и замените его в обоих репозиториях.`;
    }catch(e){status.textContent=R.errorText(e)+' Загрузка остановлена. Уже полученные ссылки сохранены. Если ВК блокирует загрузку файла, пришлите этот результат — понадобится загрузка с ноутбука.';}
    finally{lock(false);save();}
  };
  page.querySelector('#relayExport').onclick=()=>{
    save();const url=URL.createObjectURL(new Blob([output.value],{type:'text/javascript;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='relay-photos.js';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    status.textContent=`В файле готовы ${count()}/${R.photos.length} фотографий. Один и тот же файл нужен в обоих репозиториях.`;
  };
  page.querySelector('.relay-back').onclick=()=>{if(!running)page.hidden=true;};
  window.RelayUpload={open(){page.hidden=false;save();status.textContent=`Готовы ссылки: ${count()}/${R.photos.length}`;}};
})();
