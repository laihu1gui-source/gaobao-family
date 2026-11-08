(()=>{
  const button=document.getElementById('installApp'),status=document.getElementById('installStatus');
  if(!button||!status)return;
  let promptEvent=null;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=()=>/android/i.test(navigator.userAgent);
  const show=text=>{status.textContent=text;status.hidden=false;};
  if(standalone()){button.textContent='已安装到手机';button.disabled=true;}
  else if(ios()){
    button.textContent='查看 iPhone 安装方法';
    show('请在 Safari 打开本网址，点“分享”图标，再选“添加到主屏幕”并确认。');
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;button.textContent='安装择据';show('此浏览器支持一键安装，请点上方“安装择据”。');});
  window.addEventListener('appinstalled',()=>{button.textContent='已安装到手机';button.disabled=true;show('现在可以从手机桌面打开择据。');});
  button.addEventListener('click',async()=>{
    if(standalone())return;
    if(promptEvent){
      promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      promptEvent=null;
      show(choice.outcome==='accepted'?'安装完成后，可从手机桌面打开择据。':'安装未完成；确认后可再次点“安装择据”。');
    }else if(ios())show('请在 Safari 打开本网址，点“分享”图标，再选“添加到主屏幕”并确认。');
    else if(android())show('请在 Chrome 打开本网址；点右上角“⋮”，选择“安装应用”或“添加到主屏幕”。若菜单里没有这两项，请从微信等内置浏览器复制网址，在手机 Chrome 中打开。');
    else show('当前浏览器没有提供安装入口。请用手机系统浏览器打开本网址：Android 用 Chrome，iPhone 用 Safari；内置浏览器可能不支持安装。');
  });
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
