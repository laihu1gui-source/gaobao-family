(()=>{
  const get=id=>document.getElementById(id),storageKey='zeju-family-decision-v1';
  const conditions=['倒班','偏远','野外','海上'];
  const labels={倒班:'倒班',偏远:'偏远 / 基层',野外:'野外 / 井下 / 外业',海上:'海上工作'};
  const opinions=[['unknown','还不了解'],['keep','愿意继续了解'],['no','不愿选择']];
  const textFields=['studentReason','parentReason','tradeoff','question','contact','nextAction','teacher'];
  const validKeys=new Set(window.GAOBAO_DATA.projects.map(project=>`${project.schoolCode}-${project.groupCode}-${project.majorCode}`));
  let state={mode:'demo',conditions:{},notes:{},demoNotes:{}},cards=[],saveFailed=false;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved&&typeof saved==='object'){
      state.mode=saved.mode==='mine'?'mine':'demo';
      for(const condition of conditions)state.conditions[condition]=['yes','no','unknown'].includes(saved.conditions?.[condition])?saved.conditions[condition]:'unknown';
      for(const collection of ['notes','demoNotes'])for(const [key,note] of Object.entries(saved[collection]||{})){
        if(!validKeys.has(key)||!note||typeof note!=='object')continue;
        state[collection][key]={};
        for(const field of ['student','parent'])state[collection][key][field]=opinions.some(([value])=>value===note[field])?note[field]:'unknown';
        for(const field of textFields)state[collection][key][field]=typeof note[field]==='string'?note[field].slice(0,600):'';
      }
    }
  }catch{saveFailed=true;}
  get('profileSaveStatus').insertAdjacentHTML('afterend','<div class="family-mode"><p id="profileModeStatus" role="status"></p><button type="button" class="secondary-button" id="startPersonalProfile">清空演示，开始填写</button></div>');
  get('conditions').insertAdjacentHTML('afterend',`<fieldset id="personalConditions" hidden><legend>学生对工作条件的态度</legend><p class="field-help">还不了解不代表同意，也不直接排除候选；会在决策单中提醒讨论。</p>${conditions.map(condition=>`<label>${escape(labels[condition])}<select data-personal-condition="${escape(condition)}"><option value="unknown">还不了解</option><option value="yes">可以考虑</option><option value="no">不能接受</option></select></label>`).join('')}</fieldset>`);
  get('comparison').insertAdjacentHTML('beforebegin','<section class="panel family-decision" id="familyDecision" aria-labelledby="familyDecisionHeading"><h3 id="familyDecisionHeading" tabindex="-1">家庭决策单</h3><p>先分别表达意见，再讨论选择代价和下一步。不生成适配总分，也不代替学生作决定。</p><p class="field-help">证据等级表示材料核验程度，不是学校质量或孩子适配排名。演示与真实档案的备注分开保存。备注不进入分享链接；本机浏览器并非加密档案，请勿填写姓名、电话、身份证或其他敏感信息。</p><p id="decisionSaveStatus" role="status"></p><div id="familyDecisionBody"></div><button type="button" class="text-button" id="clearFamilyNotes">清除本机讨论备注</button></section>');
  function currentNotes(){return state.mode==='demo'?state.demoNotes:state.notes;}
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify(state));saveFailed=false;}catch{saveFailed=true;}
    get('decisionSaveStatus').textContent=saveFailed?'本机保存失败；本次填写仍可使用，请勿关闭页面。':'讨论备注已保存到本机浏览器；没有上传。';
  }
  function applyMode(){
    const personal=state.mode==='mine';
    get('profileModeStatus').textContent=personal?'我的情况：请确认分数、选科、预算和学历规划；未了解的工作条件不视为同意。':'演示条件：初始550分、物化、学费上限3万元、收入目标8万元和工作条件均为示例，不代表学生同意；修改筛选后仍是演示模式。';
    get('startPersonalProfile').hidden=personal;get('conditions').hidden=personal;get('personalConditions').hidden=!personal;
    for(const select of document.querySelectorAll('[data-personal-condition]'))select.value=state.conditions[select.dataset.personalCondition]||'unknown';
    if(personal)for(const checkbox of document.querySelectorAll('#conditions input'))checkbox.checked=state.conditions[checkbox.value]!=='no';
  }
  function startPersonal(){
    state.mode='mine';state.conditions=Object.fromEntries(conditions.map(condition=>[condition,'unknown']));
    comparison.clear();
    for(const id of ['score','tuition','salaryTarget'])get(id).value='';
    for(const [id,value] of Object.entries({query:'',sort:'signal',institutionFilter:'all',readinessFilter:'all'}))get(id).value=value;
    get('degreePlan').value='undecided';for(const checkbox of document.querySelectorAll('#subjects input'))checkbox.checked=false;
    applyMode();save();get('score').dispatchEvent(new Event('input',{bubbles:true}));get('score').focus();
  }
  function opinion(key,role,title,note){
    return `<label>${title}<select data-decision-key="${escape(key)}" data-decision-field="${role}">${opinions.map(([value,label])=>`<option value="${value}"${(note[role]||'unknown')===value?' selected':''}>${label}</option>`).join('')}</select></label>`;
  }
  function field(key,name,label,note){
    return `<label>${label}<textarea maxlength="600" rows="2" data-decision-key="${escape(key)}" data-decision-field="${name}">${escape(note[name]||'')}</textarea></label>`;
  }
  function discussion(note){
    if(!note.student||!note.parent||note.student==='unknown'||note.parent==='unknown')return '尚未形成共识：请学生和家长分别表达，不替对方填写。';
    if(note.student!==note.parent)return '存在分歧：先听双方理由，不取平均分，也不自动替任何一方决定。';
    return note.student==='no'?'双方暂不愿选择：保留理由，是否移出对比由你们决定。':'双方愿意继续了解：不等于已决定报考，仍需核实关键未知。';
  }
  function conditionSummary(card){
    if(state.mode!=='mine')return '演示模式的工作条件不是学生意愿。';
    if(!card.hardships.length)return '目前职业线索未标出上述条件，不代表实际岗位没有其他代价。';
    return card.hardships.map(condition=>`${labels[condition]||condition}：${state.conditions[condition]==='no'?'学生不能接受，存在冲突':state.conditions[condition]==='yes'?'可以考虑，具体岗位仍需核实':'还不了解，需要讨论'}`).join('；');
  }
  function summary(card,note){
    const meaningful=value=>typeof value==='string'&&value.trim().length>0;
    const missing=[!note.student||note.student==='unknown'?'学生意愿':null,!note.parent||note.parent==='unknown'?'家长意见':null,!meaningful(note.tradeoff)?'选择代价':null,!meaningful(note.question)?'待核实问题':null,!meaningful(note.contact)?'核实对象':null,!meaningful(note.nextAction)?'下一步行动':null].filter(Boolean);
    return `<p class="decision-consensus">${escape(discussion(note))}</p><p>${escape(conditionSummary(card))}</p><p>${missing.length?'讨论待补：'+escape(missing.join('、')):'讨论要点已填写；不代表证据已核实或推荐通过。'}</p>`;
  }
  function render(nextCards){
    cards=nextCards;const invalid=get('scope').textContent.startsWith('请输入');
    get('familyDecisionBody').innerHTML=`<p class="decision-context">${state.mode==='mine'?'我的情况':'演示模式（非真实家庭结论）'} · ${escape(get('score').value||'待填')}分 · ${escape([...document.querySelectorAll('#subjects input:checked')].map(input=>input.value).join(' / ')||'选科待填')} · 学费上限${get('tuition').value?escape(get('tuition').value)+'元/年':'未设定'} · ${escape(get('degreePlan').selectedOptions[0]?.text||'学历规划待填')}。学费不含住宿、生活、交通和升学成本。</p>${invalid?'<p class="risk">当前筛选输入无效或未填；保留讨论记录，不提供当前招生适配结论。</p>':''}${cards.length===0?'<p>先在学校与专业清单中加入2—4项，再分别填写意见。只有1项也可以先记录问题。</p>':cards.map(card=>{const note=currentNotes()[card.key]||{};return `<article class="decision-project" data-decision-card="${escape(card.key)}"><h4>${escape(card.school)} · ${escape(card.major)}</h4><dl class="decision-facts"><div><dt>值得继续了解的依据</dt><dd>${escape(invalid?'请先补齐筛选条件；暂不提供保留判断':card.reason)}</dd></div><div><dt>首要风险</dt><dd>${escape(invalid?'当前适配风险待输入完整后判断':card.risk)}</dd></div><div><dt>招生参考</dt><dd>${escape(invalid?'当前输入待修正，暂不作适配判断':card.admission)}</dd></div><div><dt>证据范围</dt><dd>${escape(card.evidence)}</dd></div><div><dt>优先核实线索</dt><dd>${escape(card.gap)}</dd></div></dl>${window.ZEJU_PATHWAYS?.panel(card.key,true)||''}${window.ZEJU_LEARNING?.program(card.key)||''}<div class="decision-summary" data-summary-key="${escape(card.key)}">${summary(card,note)}</div><div class="decision-editors"><fieldset><legend>学生自己说</legend>${opinion(card.key,'student','我的态度',note)}${field(card.key,'studentReason','我想学 / 不想做 / 还不清楚的事',note)}</fieldset><fieldset><legend>家长单独说</legend>${opinion(card.key,'parent','家长的态度',note)}${field(card.key,'parentReason','家长重视的条件和担忧',note)}</fieldset></div><div class="decision-next">${field(card.key,'tradeoff','选择代价：费用、城市、学习或工作方式',note)}${field(card.key,'question','最可能改变选择的一个问题',note)}${field(card.key,'contact','找谁核实 / 查什么原件（不填个人联系方式）',note)}${field(card.key,'nextAction','下一步谁来做什么；得到什么答案后再讨论',note)}${field(card.key,'teacher','教师或辅导者建议（可选；不是学校官方推荐）',note)}</div><p class="field-help">以上填写内容是家庭意见或待办，不自动变成已核事实；移出对比仍保留备注，再次加入可恢复。</p></article>`;}).join('')}`;
    get('decisionSaveStatus').textContent=saveFailed?'本机保存不可用；当前填写不会上传，也可能无法在刷新后保留。':'备注仅保存在本机；打印前请确认内容和隐私。';
  }
  function record(event){
    const control=event.target,key=control.dataset.decisionKey,name=control.dataset.decisionField;
    if(!validKeys.has(key)||!['student','parent',...textFields].includes(name))return;
    const notes=currentNotes(),note=notes[key]||(notes[key]={});note[name]=control.value.slice(0,600);save();
    const card=cards.find(item=>item.key===key),box=[...document.querySelectorAll('[data-summary-key]')].find(item=>item.dataset.summaryKey===key);
    if(card&&box)box.innerHTML=summary(card,note);
  }
  get('familyDecision').addEventListener('input',record);get('familyDecision').addEventListener('change',record);
  get('startPersonalProfile').addEventListener('click',startPersonal);
  get('personalConditions').addEventListener('change',event=>{const condition=event.target.dataset.personalCondition;if(!conditions.includes(condition))return;state.conditions[condition]=event.target.value;applyMode();save();get('score').dispatchEvent(new Event('input',{bubbles:true}));});
  get('clearFamilyNotes').addEventListener('click',()=>{if(!window.confirm('清除演示和真实档案的全部本机讨论备注？筛选条件和对比项目不会删除。'))return;state.notes={};state.demoNotes={};save();render(cards);get('familyDecisionHeading').focus();});
  window.addEventListener('beforeprint',()=>{
    for(const control of get('familyDecision').querySelectorAll('textarea,select')){
      if(control.nextElementSibling?.classList.contains('decision-print-value'))control.nextElementSibling.remove();
      const value=document.createElement('span');value.className='decision-print-value';value.textContent=control.tagName==='SELECT'?control.selectedOptions[0]?.text||'未填':control.value||'未填';control.after(value);
    }
  });
  window.addEventListener('afterprint',()=>get('familyDecision').querySelectorAll('.decision-print-value').forEach(node=>node.remove()));
  window.ZEJU_FAMILY={render,mode:()=>state.mode,conditionValues:()=>conditions.map(condition=>state.conditions[condition]||'unknown').join(','),restore(){
    const params=new URL(location.href).searchParams;
    if(params.has('profileMode'))state.mode=params.get('profileMode')==='mine'?'mine':'demo';
    if(state.mode==='mine'&&params.has('workConditions')){
      const values=params.get('workConditions').split(',');
      conditions.forEach((condition,index)=>state.conditions[condition]=['yes','no','unknown'].includes(values[index])?values[index]:'unknown');
    }
    applyMode();save();
  },demo(){state.mode='demo';applyMode();save();}};
})();
