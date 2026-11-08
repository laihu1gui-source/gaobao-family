(()=>{
  const button=document.getElementById('installApp'),status=document.getElementById('installStatus');
  if(!button||!status)return;
  let promptEvent=null;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const show=text=>{status.textContent=text;status.hidden=false;};
  if(standalone()){button.textContent='已安装到手机';button.disabled=true;}
  else if(ios()){
    button.textContent='iPhone 安装方法';
    show('请用 Safari 打开，点底部“分享”，再选“添加到主屏幕”。');
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;});
  window.addEventListener('appinstalled',()=>{button.textContent='已安装到手机';button.disabled=true;show('现在可以从手机桌面打开择据。');});
  button.addEventListener('click',async()=>{
    if(standalone())return;
    if(promptEvent){
      promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      promptEvent=null;
      show(choice.outcome==='accepted'?'安装完成后，可从手机桌面打开择据。':'安装未完成；你也可以从浏览器菜单选择“安装应用”。');
    }else if(ios())show('请用 Safari 打开，点底部“分享”，选择“添加到主屏幕”，再点“添加”。');
    else show('点手机浏览器右上角菜单，选择“安装应用”或“添加到主屏幕”。');
  });
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
