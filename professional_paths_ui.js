(function(){
  const data=window.ZEJU_PROFESSIONAL_PATHS;if(!data)return;
  const projects=new Map(data.projects.map(project=>[project.key,project]));
  const roles=new Map(data.roles.map(role=>[role.id,role]));
  const profiles=new Map(data.abilities.map(profile=>[profile.candidateId,profile]));
  const selections=new Map();
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const value=number=>number==null?'未披露／未核':esc(number)+'人';
  const safeUrl=url=>/^https?:\/\//.test(String(url))?esc(url):'#';
  function sourceLink(source,locator){return '<a href="'+safeUrl(source.url)+'" target="_blank" rel="noopener noreferrer">核对原件：'+esc(source.title)+'</a> · '+esc(locator||source.scope);}
  function numbers(project){
    const outcome=project.historicalOutcome,employment=project.employment;
    let rows=[['全国／目标城市岗位总量','未覆盖；不把已抓到的职位条数当市场总量'],['本校本专业实际到岗、6／12月留任','未核；不是0人']];
    if(outcome){rows.push([outcome.cohortYear+'届本科毕业生',value(outcome.denominator)]);rows.push(['原报告毕业去向落实',outcome.reportedRatePercent+'%；分子'+(outcome.numerator==null?'未直接披露（不逆算）':outcome.numerator+'人')+'；不是纯就业率']);if(outcome.furtherStudyDomestic!=null)rows.push(['同届升学人数','国内'+outcome.furtherStudyDomestic+'人；境外'+(outcome.furtherStudyOverseas??'未披露')+'人；不从落实率倒推其他去向']);if(outcome.furtherStudyRatePercent!=null)rows.push(['同届深造率',outcome.furtherStudyRatePercent+'%；不可从落实率相减后当实际到岗率']);}
    else rows.push(['本校本专业毕业届次与分母','未核到可比的届次专业表；未覆盖不等于无人就业']);
    if(employment){rows.push(['专业对口表报告就业数',employment.reportedEmployment+'人（学校报告，非独立到岗核验）']);rows.push(['专业对口人数／该表就业数',employment.matchedEmployment+'/'+employment.matchDenominator+'＝'+employment.reportedMatchRatePercent+'%；不是对全体毕业生的就业率']);}
    const observations=project.observations.length?'<h4>公开名单：按年份、阶段、学历分开</h4><ul>'+project.observations.map(group=>'<li>'+esc(group.year)+'年 · '+esc(group.stage)+' · '+esc(group.degree)+'：'+group.recordIds.length+'条去重记录；符合原匹配口径的已知数量'+value(group.knownCount)+(group.unknownCountRows?'；另有'+group.unknownCountRows+'条未计数／目标学历不一致':'')+'。毕业届次与同届分母未核。</li>').join('')+'</ul>':'<p>同校同专业拟聘／拟录用名单未覆盖；不记为0。</p>';
    return '<div class="path-numbers"><dl>'+rows.map(([label,text])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(text)+'</dd></div>').join('')+'</dl>'+(outcome?'<p>统计截至'+esc(outcome.asOf)+'；'+sourceLink({url:outcome.source.url,title:outcome.cohortYear+'届学校报告'},outcome.locator)+'</p>':'')+(employment?'<p>'+sourceLink(data.sources.find(source=>source.id===employment.sourceId),employment.locator)+'</p><p class="path-warning">'+esc(employment.warning)+'</p>':'')+observations+'</div>';
  }
  function roleCard(role){
    const plan=role.plan;
    return '<article class="path-role" data-role-id="'+esc(role.id)+'"><h4>'+esc(role.name)+'</h4><p><strong>'+esc(role.relation)+'</strong>'+(role.employer?' · '+esc(role.employer):'')+'</p><p><strong>做什么：</strong>'+(role.tasks.length?esc(role.tasks.join('；')):'原件未细列任务；未用岗位名称补造职责')+'</p><p class="muted">任务依据：'+esc(role.taskBasis)+'</p><p><strong>门槛：</strong>'+esc(role.qualification||'未核')+'</p><p><strong>工作条件：</strong>'+esc(role.conditions||'未核')+'</p>'+(plan?'<p><strong>原岗位计划：</strong>'+value(plan.count)+' · '+esc(plan.year)+'年 · '+esc(plan.positionCode||'无岗位代码')+'。所有可报专业／学历共享；不是本专业独占名额，也不是本校就业人数。</p><p><strong>本科竞争专业：</strong>'+esc(plan.eligibleUndergraduateMajors.join('、'))+'。更高／更低学历可报范围仍按原表，不由本科栏推断。</p>':'<p>仅有培养方向依据，没有可相加的招聘名额。</p>')+'<p>'+sourceLink(role.source,role.locator)+'</p><p class="muted">历史样本，未确认仍在招；不保证本校毕业生可进入。'+(role.majorCode?'基础专业代码 '+esc(role.majorCode)+'；招生专业代码不是该代码。':'')+'</p></article>';
  }
  function abilityResult(project,stage){
    if(!stage)return '<p>先选择想核对的学习证据阶段。未做过不等于没有潜力，高中生不应被要求已有大学实验或实习经历。</p>';
    return project.abilityProfileIds.map(id=>{const profile=profiles.get(id),level=profile.levels.find(item=>item.id===stage);return '<article><h4>'+esc(profile.title)+' · '+esc(level.label)+'</h4><p>'+esc(level.task)+'</p><p><strong>拿什么核对：</strong>'+esc(profile.deliverables)+'</p><p class="muted">'+esc(profile.basis)+'</p></article>';}).join('');
  }
  function ability(project){
    if(!project.abilityProfileIds.length)return '<p>此专业尚未补岗位相关的能力观察框架；不套用其他专业。</p>';
    const selected=selections.get(project.key)||'';
    return '<p>分层看可观察任务，不按高考分数、学校档次或学历给人贴强弱标签。学历／资格是准入条件，不能替代实践能力。</p><label>当前想核对哪类学习证据？<select data-path-level="'+esc(project.key)+'" aria-label="'+esc(project.school+' '+project.major)+'的学习证据阶段"><option value="">尚未判断</option>'+profiles.get(project.abilityProfileIds[0]).levels.map(level=>'<option value="'+level.id+'"'+(level.id===selected?' selected':'')+'>'+esc(level.label)+'</option>').join('')+'</select></label><div data-path-level-result="'+esc(project.key)+'" aria-live="polite">'+abilityResult(project,selected)+'</div><p class="path-warning">这是学习讨论框架，不是已验证的能力测评。各层就业人数、录用率、工资及晋升年限均未取得，不能生成概率。本次选择不保存到家庭档案。</p>';
  }
  function panel(key,compact=false){
    const project=projects.get(key);if(!project)return '';
    const mapped=project.roleIds.map(id=>roles.get(id));
    const readiness=window.GAOBAO_DECISION_READINESS,hasNew=readiness?.hasRoleEvidence(key),newRoles=readiness?.projectFor(key)?.qualificationRequirements.requirements||[];
    const roleHeading=hasNew?'旧任务能力岗位卡 · '+mapped.length+'个；另有深核岗位证据':'具体岗位与门槛 · '+mapped.length+'个已整理样本';
    const missingRoles=hasNew?'旧任务能力卡未整理此专业；已核基础专业岗位见本轮深核区，不表示没有岗位原件。':'没有经过本轮整理的具体岗位卡。原职业族标签不能替代岗位字典。';
    const planNote=project.planExamples.length?'已有精确专业招聘计划样本'+project.planExamples.length+'条，来源覆盖有限，不相加为市场总量；未整理职责的样本仍需补证。':hasNew?'本轮深核已补基础专业资格或计划对应；不等于完整项目资格。':'精确专业招聘计划未覆盖。';
    const contents='<p class="path-warning">局部补强，尚未达到完整职业字典标准。'+esc(project.limitations.join(' '))+'</p><details'+(!compact?' open':'')+'><summary>就业数量：哪些是人数，哪些不是</summary>'+numbers(project)+'</details><details><summary>'+roleHeading+'</summary>'+(mapped.length?mapped.map(roleCard).join(''):'<p>'+missingRoles+'</p>')+'<p>'+planNote+'</p></details><details'+(!compact?' open':'')+'><summary>按学习证据阶段看能力与差距</summary>'+ability(project)+'</details>';
    return '<section class="professional-paths" data-professional-project="'+esc(key)+'"><h3>专业 → 岗位 → 数量 → 能力</h3><p>'+esc(project.school+' · '+project.major)+' · '+esc(hasNew&&!mapped.length?'旧任务能力卡未补；本轮深核有'+newRoles.length+'个基础专业资格样本、'+(readiness.projectFor(key).qualificationRequirements.recruitmentLinks.length)+'条计划对应':project.mappingStatus)+'</p>'+contents+'</section>';
  }
  document.addEventListener('change',event=>{const key=event.target.dataset?.pathLevel;if(!key)return;const stage=event.target.value,project=projects.get(key);if(!project||!['','1','2','3','4'].includes(stage))return;selections.set(key,stage);document.querySelectorAll('[data-path-level]').forEach(select=>{if(select.dataset.pathLevel===key)select.value=stage;});document.querySelectorAll('[data-path-level-result]').forEach(box=>{if(box.dataset.pathLevelResult===key)box.innerHTML=abilityResult(project,stage);});});
  const heading=document.getElementById('discoverHeading');
  if(heading){const notice=document.createElement('div');notice.className='path-coverage';notice.setAttribute('role','note');notice.innerHTML='<strong>专业就业专项审核：仍未达完整决策标准</strong><p>'+data.summary.directions+'个方向中，仅'+data.summary.directionsWithReviewedRoles+'个方向整理了'+data.summary.reviewedRoleCards+'张岗位／培养方向卡；其中'+data.summary.reviewedRecruitmentRoleCards+'张来自招聘，'+data.summary.curriculumDirectionCards+'张仅来自培养目标。关联'+data.summary.projectsWithReviewedRole+'/130项目≠逐校验证就业；'+data.summary.projectsWithoutReviewedRole+'项目仍无结构化岗位卡。就业数表1项，历史去向指标6项，实际到岗和分层就业结果未核。</p><p><a href="PROFESSIONAL_AUDIT_2026-10-18.md" target="_blank" rel="noopener">完整审核与未达标清单</a></p>';heading.parentElement.after(notice);}
  window.ZEJU_PATHWAYS={panel,projectFor:key=>projects.get(key)||null,summary:data.summary};
})();
