(() => {
  const content=window.GAOBAO_CONTENT;if(!content)return;
  const byId=new Map(content.topics.map(t=>[t.id,t])),works=new Map(content.works.map(w=>[w.id,w]));
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={title_only:'标题线索，正文未核',machine_draft:'机器稿，未校对',reviewed_excerpts:'部分画面摘录已核'};
  const kindLabels={anonymous_case:'匿名投稿案例',self_report:'视频呈现的第一人称叙述',generalization:'作者泛称',recruitment_repost:'作者转载招聘画面，非雇主原件'};
  const factorLabels={pay:'薪酬',qualification:'学历资格',destination:'单位岗位',cost_and_risk:'代价风险',outcome:'就业节点',method:'样本方法',time_and_place:'时间地域'};
  const dimensionLabels={verified:'原件明确',partial:'仅部分明确',conflicting:'冲突/变化待厘清',unknown:'未核'};
  const reviewFields={finding:'发现',entry:'入口与门槛',pay_basis:'收入口径',pay_claim:'作者薪酬主张',pay_limit:'工资可比性与边界',work_mode:'工作条件和代价',challenge:'质疑',next_check:'下一项核验'};
  function deepDetails(w){
    const d=w.deepReview;if(!d)return '';
    return `<h4>逐作品研究卡 · ${d.basis==='full_machine_text'?'全文机器稿读后分析，未听音校正':'画面型资料分析'}</h4><table><tbody>${Object.entries(reviewFields).map(([key,label])=>`<tr><th scope="row">${esc(label)}</th><td>${esc(d[key])}</td></tr>`).join('')}</tbody></table><p class="muted">专业关联为待核检索线索，不是资格映射已核。拟录用、签约、到岗、6/12个月留任和实发工资均未由本资料确认。</p>${d.windows.length?`<details><summary>机器原文与时间定位 · 非准确引文</summary>${d.windows.map(a=>`<p>${esc(a.factor)} · ${a.start}—${a.end}秒<br><q>${esc(a.text)}</q></p>`).join('')}</details>`:''}`;
  }
  function primaryDetails(c){
    if(!c.documents)return '';
    const n=c.dimensionCoverage;
    return `<p class="muted">证据覆盖：${n.explicit}/${n.total}项明确，${n.partial}项部分明确，${n.conflicting}项冲突/变化；不是就业概率。${c.documents.length}份原件 / ${c.evidenceFamilies}个来源家族。</p><table><thead><tr><th>核验项</th><th>状态</th></tr></thead><tbody>${Object.entries(c.dimensions).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(dimensionLabels[v])}</td></tr>`).join('')}</tbody></table><details><summary>逐份原件、学历与口径</summary>${c.documents.map(d=>`<p><a href="${esc(d.url)}" target="_blank" rel="noreferrer">${esc(d.title)}</a> · <a href="${esc(d.capture)}" target="_blank">留存原件</a><br>${d.year}届/年 · ${esc(d.stage)} · ${esc(d.degree)}<br>${esc(d.locator)}<br><q>${esc(d.quote)}</q><br><small>来源家族：${esc(d.family)}；抓取：${esc(d.retrievedAt||'此前抓取，精确时间未记录')}</small></p>`).join('')}</details>`;
  }

  const supplement=content.learningSupplement;
  const sourceIndex=new Map((supplement?.sources||[]).map(source=>[source.id,source]));
  const link=(url,label)=>/^https?:\/\//.test(url||'')?`<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`:esc(label);
  function learningCard(key){
    const card=supplement?.programs.find(item=>item.key===key);if(!card)return '';
    return `<section class="learning-card" data-learning-key="${esc(key)}"><h4>学什么、付出什么、先问谁</h4><p class="muted">${esc(card.cohort)} · 核对：${esc(supplement.checkedAt)}；不计入排序分。</p>${card.sections.map(item=>`<details open><summary>${esc(item.label)} · ${esc(item.status)}</summary><p>${esc(item.text)}</p><small>定位：${esc(item.locator)}</small><div class="sources">${item.sourceIds.map(id=>{const source=sourceIndex.get(id);return source?link(source.url,'原件：'+id):'';}).join(' ')}</div></details>`).join('')}<p>${link(card.planSource,'原北京招生计划（费用复用来源）')}</p><h5>家庭现在可以问</h5><ul>${card.questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ul><details><summary>尚未确认，不能替代的证据</summary><ul>${card.unknowns.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details></section>`;
  }
  function creatorCards(topicId,excluded=''){
    if(!supplement)return '';
    const cards=supplement.creators.filter(card=>card.id!==excluded&&(!topicId||card.topicIds.includes(topicId)));
    return cards.length?`<section class="learning-card"><h3>博主说法回到原件 · 已有资料复用</h3><p>下列是检索和家庭提问线索，不表示当前学校专业能进入这些雇主。招聘不等于录用或实发工资。</p>${cards.map(card=>`<details data-creator-review="${esc(card.id)}"><summary>${esc(card.title)} · ${esc(card.conclusion)}</summary><p>作者：${esc(card.creator)}；${esc(card.identity)}；来源家族：${esc(card.sourceFamily)}</p><p><strong>博主主张：</strong>${esc(card.claim)}</p><p><strong>工作代价：</strong>${esc(card.workCost)}</p><p class="risk">${esc(card.limit)} ${esc(card.payLimit)}</p><p>${esc(card.excerpt?.text||card.excerpt?.kind||'未取得准确引文')}${card.excerpt?.text?'（此前画面短摘录）':''}</p><p>${card.anchors.map(anchor=>esc(anchor.factor)+' '+anchor.start+'—'+anchor.end+'秒').join('；')||'画面定位：'+(card.excerpt?.evidence||[]).map(item=>item.seconds+'秒').join('、')}；机器定位不是准确引文。</p><div class="sources">${link(card.sourceUrl,'原作品')} ${card.evidence.map(source=>link(source.url,source.title+' · '+source.year)).join(' ')}</div><p class="muted">原件家族：${esc([...new Set(card.evidence.map(source=>source.family))].join('；'))}；转载、附件不另算独立结果。</p><ul>${card.questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ul></details>`).join('')}</section>`:'';
  }
  function previewCard(id){
    const preview=supplement?.previews.find(item=>item.id===id);if(!preview)return '';
    return `<section class="learning-card" data-machine-preview="${esc(id)}"><h4>本轮选段预览 · ${esc(preview.decision)}</h4><p>${esc(preview.authorType)}</p><p>${esc(preview.finding)}</p><p>定位：${preview.windows.map(item=>item.start+'—'+item.end+'秒').join('；')}；未回听、未核画面，不采用数字。</p><p>下一步：${esc(preview.question)}</p></section>`;
  }
  window.ZEJU_LEARNING={program:learningCard,creators:creatorCards,preview:previewCard};
  let rows=[],page=0,paused=false;
  function topicsForRows(projects){const ids=new Set(projects.flatMap(p=>p.candidateIds));return content.topics.filter(t=>t.candidateId&&ids.has(t.candidateId));}
  function filterWorks(topicId,query='',status='',type='',excluded='',factor=''){
    return content.works.filter(w=>(!topicId||(topicId==='unmatched'?!w.topicIds.length:w.topicIds.includes(topicId)))&&w.id!==excluded&&(!status||(status==='deep_analysis'?!!w.deepReview:w.status===status))&&(!type||w.contentType===type)&&(!factor||w.machineFactors[factor]>0)&&(!query||[w.title,w.creator,w.mappingNote,w.machineSearchText,...Object.keys(reviewFields).map(k=>w.deepReview?.[k]||''),...content.claims.filter(c=>c.sourceId===w.id).map(c=>Object.values(c.fields||{}).join(' '))].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>Number(b.status==='reviewed_excerpts')-Number(a.status==='reviewed_excerpts')||Number(!!b.deepReview)-Number(!!a.deepReview)||Number(!!b.draftPath)-Number(!!a.draftPath)||a.id.localeCompare(b.id));
  }
  function render(){
    if(!$('contentTopic'))return;
    if(paused){$('contentStatus').textContent='输入条件无效，暂停显示职业内容与关联学校。';['contentBrief','contentSchools','contentEvidence','contentWorks','contentQueue'].forEach(id=>$(id).innerHTML='');$('contentCount').textContent='';$('contentPrev').disabled=true;$('contentNext').disabled=true;return;}
    const all=$('contentScope').value==='all',available=all?content.topics:topicsForRows(rows),previous=$('contentTopic').value;
    $('contentTopic').innerHTML=(all?'<option value="">全部主题</option>':'')+available.map(t=>`<option value="${t.id}">${esc(t.name)} · ${t.workIds.length}条</option>`).join('')+(all?'<option value="unmatched">未映射资料</option>':'');
    $('contentTopic').value=(previous===''&&all)||available.some(t=>t.id===previous)||(all&&previous==='unmatched')?previous:available.find(t=>t.excerptIds.length)?.id||available.find(t=>t.workIds.length)?.id||available[0]?.id||'';
    const topic=byId.get($('contentTopic').value),scopeId=topic?.id||$('contentTopic').value;
    const excluded=$('contentExclude').value;
    const topicWorks=scopeId?filterWorks(scopeId):all?content.works:[];
    $('contentExclude').innerHTML='<option value="">保留全部作品</option>'+topicWorks.map(w=>`<option value="${w.id}">移除：${esc(w.creator+' · '+w.title)}</option>`).join('');
    $('contentExclude').value=topicWorks.some(w=>w.id===excluded)?excluded:'';
    const selected=all||topic?filterWorks(scopeId,$('contentQuery').value.trim(),$('contentStatusFilter').value,$('contentType').value,$('contentExclude').value,$('contentFactor')?.value||''):[];
    const excerpts=content.claims.filter(c=>c.sourceId!==$('contentExclude').value&&(!scopeId||c.topicIds.includes(scopeId)));
    $('contentStatus').textContent=`资料库${content.summary.works}条 / ${content.summary.accounts}个公开账号；${content.summary.audios}部已取音频，${content.summary.machineDrafts}部有机器稿，${content.summary.machineCandidates||0}个待核因子窗口。${content.summary.machineReadWorks||0}部形成跨作品审阅笔记（非校对），${content.summary.reviewedWorks}部有部分画面核对摘录。新增P0核验${content.summary.primaryChecks||0}项 / ${content.summary.primaryDocuments||0}份原件 / ${content.summary.primaryEvidenceFamilies||0}个来源家族；${content.summary.advertisedPayChecks||0}项广告薪酬有出处，独立核实实际工资${content.summary.independentlyVerifiedSalary}条。${content.summary.partialMultipartWorks||0}条仅取分P片段；${content.summary.qualityFlaggedWorks||0}条有机器质量警报。窗口不等于人数。`;
    $('contentStatus').textContent+=` 单源深加工${content.summary.deepAnalyzedWorks||0}张逐作品研究卡（${content.summary.fullMachineTextReadWorks||0}条全文机器稿、${content.summary.visualFrameAnalyzedWorks||0}条画面资料）；账号全集读取受限，总量未知，不能称全量完成。`;
    if(supplement)$('contentStatus').textContent+=` 本轮补充${supplement.programs.length}张项目学习卡、复用${supplement.creators.length}张回源卡、${supplement.previews.length}条机器稿选段预览；无新增实发工资核验。`;
    $('contentBrief').innerHTML=topic?`<h3>${esc(topic.name)}${topic.candidateId?'':' · 招生目录未接入'}</h3><p>${esc(topic.brief.opportunity)}</p><div class="content-columns"><div><strong>机会成立前要核什么</strong><ul>${topic.brief.checks.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div><div><strong>代价与反证</strong><p>${esc(topic.brief.tradeoff)}</p><p class="risk">${esc(topic.gaps.join('；'))}</p></div></div><p class="muted">本主题保留${excerpts.length}条画面摘录，可能包括同一人的多段信息或行业泛称，不是${excerpts.length}位已就业毕业生。以下解读为研究判断，不是作者原话。</p>`:all?'<p>全资料库包含当前招生子集以外的路径；不得据此当作分数内报考推荐。</p>':'<p class="muted">当前筛选无招生项目，暂不关联职业内容；可切换全资料库。</p>';
    const matching=topic?.candidateId?rows.filter(p=>p.candidateIds.includes(topic.candidateId)):[];
    $('contentSchools').innerHTML=topic?`<h3>当前条件内关联项目 · ${matching.length}个</h3>${matching.length?`<ul>${matching.slice(0,8).map(p=>`<li>${esc(p.school)} · ${esc(p.major)} · 组线${p.cutoff??'未知'}分</li>`).join('')}</ul>${matching.length>8?'<p class="muted">其余见下方招生项目。</p>':''}`:`<p class="muted">${topic.candidateId?'当前条件内无匹配。':'扩展主题尚未接入招生目录。'}不代表全国无机会。</p>`}<p class="muted">职业族线索不是培养资格映射；专业组线不保证录入本专业。</p>`:'';
    if(topic?.crosschecks?.length)$('contentBrief').innerHTML+=`<h3>这条机会核验到哪一步</h3>${topic.crosschecks.filter(c=>c.documents||c.sourceId!==$('contentExclude').value).map(c=>`<div class="record"><strong>${esc(c.verdict)}</strong><p>${esc(c.claim)}</p><p>支持：${esc(c.support)}</p><p class="risk">不能推出：${esc(c.limit)}</p><p>收入口径：${esc(c.salary)}</p>${primaryDetails(c)}<details><summary>核验出处与下一项验证</summary><p>${esc(c.stage)} · 核对${esc(c.checkedAt)}</p><a href="${esc(c.url)}" target="_blank" rel="noreferrer">原始出处</a> · <a href="${esc(c.capture)}" target="_blank">留存摘录</a><p>${esc(c.next)}</p></details></div>`).join('')}`;
    if(topic?.readingNotes?.length)$('contentBrief').innerHTML+=`<h3>跨作品审阅判断 · 非事实核验</h3>${topic.readingNotes.filter(n=>!n.source_ids.includes($('contentExclude').value)).map(n=>`<details class="record"><summary>${esc(n.title)}</summary><p>${esc(n.finding)}</p><p class="risk">质疑：${esc(n.challenge)}</p><p>要验证什么：${esc(n.next_check)}</p><div class="sources">${n.source_ids.map(id=>`<a href="${esc(works.get(id)?.machineCardPath||works.get(id)?.url)}" target="_blank">${esc(works.get(id)?.creator||id)} · ${id}</a>`).join('')}</div></details>`).join('')}`;
    if(all||topic)$('contentBrief').innerHTML+=creatorCards(scopeId,excluded);
    if(supplement&&(all||topic)){const previews=supplement.previews.filter(note=>note.id!==excluded&&(!scopeId||works.get(note.id)?.topicIds.includes(scopeId)));if(previews.length)$('contentBrief').innerHTML+=`<details class="learning-card"><summary>本轮机器稿预览 · ${previews.length}条，非准确引文</summary>${previews.map(note=>previewCard(note.id)).join('')}</details>`;}
    const degree=$('contentDegree').value,groups=(topic?.officialGroups||[]).filter(g=>!degree||g.degree===degree);
    const notes=(topic?.auditNotes||[]).filter(n=>!degree||n.degree==='未分层'||n.degree.includes(degree));
    $('contentEvidence').innerHTML=topic?`<h3>并列公开市场原件 · ${groups.length}个阶段 / 学历分组</h3><p class="muted">仅是专业相关市场资料，不能自动当作上面学校的毕业结果。移除博主作品不改变这些官方记录。</p>${groups.length?`<ul>${groups.slice(0,12).map(g=>`<li>${g.year||'年份未知'} · ${esc(g.stage)} · ${esc(g.degree)} · <a href="${esc(g.url)}" target="_blank" rel="noreferrer">${esc(g.title)}</a>（${g.recordIds.length}条关联记录，非可相加就业人数）</li>`).join('')}</ul>${groups.length>12?'<p class="muted">其余见批量匹配；此处列前12组。</p>':''}`:'<p class="muted">当前学历与主题未接入可匹配公开名单或岗位，不是零就业。</p>'}${notes.length?`<details><summary>已核资格、背景与反证 · ${notes.length}条事件（非独立来源数）</summary>${topic.correction?`<p class="risk">${esc(topic.correction)}</p>`:''}${notes.map(n=>`<div class="record"><a href="${esc(n.url)}" target="_blank" rel="noreferrer">${esc(n.title)}</a> · ${n.year||'未知'} · ${esc(n.stage)} · ${esc(n.degree)}<br><q>${esc(n.quote)}</q><p>${esc(n.note)}</p></div>`).join('')}</details>`:''}`:'';
    page=Math.min(page,Math.max(0,Math.ceil(selected.length/20)-1));
    $('contentCount').textContent=`匹配${selected.length}条，显示${selected.length?page*20+1:0}—${Math.min((page+1)*20,selected.length)}；已核摘录也不代表工资真实。`;
    $('contentPrev').disabled=page===0;$('contentNext').disabled=(page+1)*20>=selected.length;
    $('contentWorks').innerHTML=selected.length?selected.slice(page*20,(page+1)*20).map(w=>{
      const records=content.claims.filter(c=>c.sourceId===w.id);
      const warnings=[];
      if(w.wholeWorkCaptured===false)warnings.push(`范围：仅${w.capturedPart}，整部作品未全部取得。`);
      if(w.machineQualityFlags.length)warnings.push('机器质量警报：语音覆盖或因子召回不足，需回听或核画面，不代表没有就业信息。');
      const warningHtml=warnings.map(x=>`<p class="risk">${esc(x)}</p>`).join('');
      return `<details class="content-work" ${w.status==='reviewed_excerpts'?'open':''}><summary>${esc(w.creator)} · ${esc(w.title)} <small>${labels[w.status]}${w.deepReview?' · 有逐作品研究卡':''}</small></summary>${warningHtml}<p class="muted">发布：${esc(w.publishedOn||w.publishDateDisplay||'未核')} ${w.publishedOn?'（元数据）':'（搜索卡片显示，日期未核）'}；${esc(w.mappingNote)}</p><div class="sources"><a href="${esc(w.url)}" target="_blank" rel="noreferrer">原视频</a><a href="${esc(w.accountUrl)}" target="_blank" rel="noreferrer">账号</a>${w.draftPath?`<a href="${esc(w.draftPath)}" target="_blank">内部机器稿（非校对稿）</a>`:''}${w.machineCardPath?`<a href="${esc(w.machineCardPath)}" target="_blank">候选事实卡（待核）</a><a href="${esc(w.machineCandidatePath)}" target="_blank">全部定位窗口</a>`:''}</div>${previewCard(w.id)}${deepDetails(w)}${w.machineCandidateCount?`<p class="muted">机器候选窗口${w.machineCandidateCount}个：${Object.entries(w.machineFactors).filter(([,n])=>n).map(([k,n])=>`${esc(factorLabels[k]||k)} ${n}`).join(' · ')}。同一窗口可含多因子，不能相加为案例数。</p>`:''}${records.length?records.map(c=>`<div class="content-excerpt"><a href="${esc(c.evidence[0].file)}" target="_blank"><img src="${esc(c.evidence[0].file)}" loading="lazy" alt="${esc(w.creator)} ${c.evidence[0].seconds}秒证据画面"></a><div><small>画面摘录 · ${c.evidence[0].seconds}秒 · ${esc(kindLabels[c.kind]||c.kind)}</small><blockquote>${esc(c.quote||c.evidence.map(e=>e.text).join('；'))}</blockquote><p>${esc(c.interpretation||c.note||'个人或作者陈述，身份、专业映射、收入真实性未独立核验；只用于发现职业路径。')}</p></div></div>`).join(''):`<p class="muted">${w.deepReview?'已有机器稿读后研究卡，但尚未听音校正或独立事实核验。':w.status==='machine_draft'?'已取得机器稿，尚未逐作品审阅完整正文。':'目前只取得标题，不能确认内容中的样本、方法或结论。'}</p>`}</details>`;
    }).join(''):'<p class="muted">没有匹配内容。不能推出该专业没有出路。</p>';
    $('contentWorks').querySelectorAll?.('img')?.forEach(img=>{img.width=96;img.height=132;});
    const visibleIds=new Set(available.map(t=>t.id));
    $('contentQueue').innerHTML='<ul>'+content.queue.filter(q=>all||visibleIds.has(q.topicId)).slice(0,10).map(q=>`<li><strong>${esc(q.name)}</strong> · ${q.works}作品 / ${q.accounts}账号 / ${q.reviewedExcerpts}摘录 · ${esc(q.priority)}：${esc(q.next)}</li>`).join('')+'</ul>';
  }
  window.GAOBAO_CONTENT_HELPERS={topicsForRows,filterWorks};
  window.renderCareerContent=(projects=[],invalid=false)=>{rows=projects;paused=invalid;page=0;render();};
  window.openCareerTopic=id=>{if(!byId.has(id)||paused)return;$('contentScope').value='current';$('contentTopic').value=id;['contentQuery','contentStatusFilter','contentType','contentExclude','contentFactor'].forEach(field=>{if($(field))$(field).value='';});page=0;render();};
  function init(){if(!$('contentTopic'))return;['contentScope','contentTopic','contentStatusFilter','contentType','contentExclude','contentDegree','contentFactor'].forEach(id=>$(id)?.addEventListener('change',()=>{page=0;render();}));$('contentQuery').addEventListener('input',()=>{page=0;render();});$('contentPrev').addEventListener('click',()=>{page--;render();});$('contentNext').addEventListener('click',()=>{page++;render();});}
  init();
})();
