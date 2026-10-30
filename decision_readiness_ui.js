(function(){
  const report=window.GAOBAO_DECISION_READINESS_30;
  const projects=new Map((report?.projects||[]).map(project=>[project.projectKey,project]));
  const salaryObservations=window.GAOBAO_SALARY?.observations||[];
  const salaryObservationById=new Map(salaryObservations.map(row=>[row.id,row]));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const projectFor=key=>projects.get(key)||null;
  function salaryFor(key){
    const salary=window.GAOBAO_SALARY?.projectEstimates?.[key];
    if(!salary)return null;
    const linked=(salary.sourceIds||[]).map(id=>salaryObservationById.get(id)).filter(Boolean);
    const unresolved=(salary.sourceIds||[]).some(id=>!salaryObservationById.has(id));
    const invalid=projectFor(key)?.income.excludedIntegrityAnomaly||unresolved||((salary.rankingEligible||salary.scoreEligible)&&!salary.sourceIds?.length);
    if(invalid)return {...salary,lower:null,upper:null,grade:null,score:null,rankingEligible:false,scoreEligible:false,integrityBlocked:true,evidenceKind:'untraceable',notProven:'模型区间缺少可追溯原始数字来源；保留异常记录，不展示金额或旧等级，不用于收入目标判断与排序。'};
    const employers=new Set(linked.filter(row=>row.sourceType==='job_ad'&&row.independentlyVerified).map(row=>row.sourceFamily||row.employer).filter(Boolean));
    const rankingEligible=Boolean(salary.rankingEligible&&employers.size>=2);
    const evidenceKind=linked.some(row=>row.sourceType==='job_ad')?'employer_quote':linked.some(row=>row.sourceType==='creator_title')?'creator_claim':linked.some(row=>row.sourceType==='machine_locator')?'machine_locator':'model_only';
    const evidenceLabel={employer_quote:'招聘/雇主报价',creator_claim:'博主工资主张',machine_locator:'机器定位线索',model_only:'无直接数字来源的模型范围'}[evidenceKind];
    return {...salary,rankingEligible,legacyRankingEligible:salary.rankingEligible,employerSourceFamilies:employers.size,evidenceKind,evidenceLabel,
      rankingLimit:rankingEligible?'至少有两个独立且经核的雇主报价；仍不是毕业生实发工资':'没有达到“至少两个独立且经核的雇主报价”门槛，不参与高薪排序。'};
  }
  function salaryEvidenceAudit(){
    const estimates=Object.entries(window.GAOBAO_SALARY?.projectEstimates||{});
    const counts={employer_quote:0,creator_claim:0,machine_locator:0,model_only:0,untraceable:0};
    for(const [key] of estimates)counts[salaryFor(key)?.evidenceKind||'untraceable']++;
    return {projects:estimates.length,counts,actualSalaryVerified:window.GAOBAO_SALARY?.boundaries?.actualSalaryVerified||0,
      comparable:estimates.filter(([key])=>salaryFor(key)?.rankingEligible).length,
      observations:window.GAOBAO_SALARY?.observations?.length||0,
      observationTypes:window.GAOBAO_SALARY?.summary?.byType||{}};
  }
  function summary(key){
    const project=projectFor(key);
    return project?'本轮证据就绪 '+project.evidenceReadiness.tier+'级 · '+project.evidenceReadiness.label:'未纳入本轮深核；未评级';
  }
  function historical(key){
    const project=projectFor(key),outcomes=project?.historicalOutcomes?.length?project.historicalOutcomes:project?.historicalOutcome?[project.historicalOutcome]:[],outcome=outcomes.at(-1);
    if(outcomes.length>1)return outcomes.map(row=>row.cohortYear+': '+(row.numerator??'?')+'/'+(row.denominator??'未知（未披露）')+' ('+row.reportedRatePercent+'%)').join('\uFF1B\u540C\u6821\u5386\u53F2\u5C4A\u6B21\uFF1A');
    if(!project)return '未纳入本轮深核；历史届次指标未审计，不代表没有公开结果';
    if(!outcome)return '本轮未核到目标专业届次指标；未知不等于0';
    const text=outcome.cohortYear+'届 '+outcome.educationLevel+' · '+outcome.indicator+' '+outcome.reportedRatePercent+'%；分子'+(outcome.numerator??'未知（不逆算）')+'，分母'+(outcome.denominator??'未知（未披露）');
    return text+(outcome.furtherStudyRatePercent!=null?'；深造率'+outcome.furtherStudyRatePercent+'%':'')+(outcome.professionalMatchRatePercent!=null?'；另：专业对口 '+outcome.professionalMatchNumerator+'/'+outcome.professionalMatchDenominator+'＝'+outcome.professionalMatchRatePercent+'%（分母独立）':'');
  }
  function limits(key){
    return projectFor(key)?'实发工资、独立结果交叉验证、报到和6/12个月留任未核；未达到完整强推荐门槛。证据等级不是就业概率。':'未纳入固定30项；不沿用其他项目等级或结果，不据此作强推荐。';
  }
  function hasRoleEvidence(key){
    const qualification=projectFor(key)?.qualificationRequirements;
    return Boolean(qualification?.requirements?.length||qualification?.recruitmentLinks?.length);
  }
  function roleSummary(key){
    const project=projectFor(key),qualification=project?.qualificationRequirements;
    if(!qualification)return '';
    const roles=qualification.requirements?.length||0,links=qualification.recruitmentLinks?.length||0;
    if(roles||links)return '基础专业岗位证据：'+roles+'个资格样本、'+links+'条计划对应；项目全部报名条件仍待核，不是就业率。';
    const campaigns=project?.campaignEvidence||[],ambiguous=project?.ambiguousRoleLeads||[];
    if(campaigns.length)return '集团招聘范围：'+[...new Set(campaigns.map(item=>item.publicationYear))].join('、')+'年简章列相关专业类别；具体岗位、学历及本校录用未核。';
    if(ambiguous.length)return '已找到相关岗位，但专业资格有歧义或学历未披露；未确认项目适用，不计已核资格。';
    return '';
  }
  function pathwayEvidence(project){
    if(!project)return '';
    const qualification=project.qualificationRequirements,roles=qualification?.requirements||[],links=qualification?.recruitmentLinks||[],activities=project.activityLeads||[],campaigns=project.campaignEvidence||[],ambiguous=project.ambiguousRoleLeads||[],caveats=project.qualificationCaveats||[];
    const sourceLink=(url,label)=>/^https?:\/\//.test(url||'')?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'';
    const rows=roles.map(row=>'<li><strong>'+esc(row.position)+'</strong>，'+esc(row.employer||row.employerGroup)+'<p>招聘年度'+esc(row.recruitmentYear)+(row.targetCohortYear?'；目标'+esc(row.targetCohortYear)+'届':'；目标毕业届次未核')+'；'+esc(row.qualification||'本科专业列有同名专业，其他门槛待核')+'。</p><p>'+esc(row.conditions||'工作条件未补齐')+'；'+(row.salaryQuote?'招聘报价 '+esc(row.salaryQuote.raw)+'，非毕业生实发；'+esc(row.salaryQuote.composition):'薪资未披露')+'。</p>'+sourceLink(row.sourceUrl,'岗位原件 '+row.locator)+'</li>').join('');
    const matched=links.map(link=>'<li>'+esc(link.recruitmentYear)+'年 '+esc(link.plan.employer)+'，'+esc(link.plan.position)+'<p>岗位最低'+esc(link.plan.degree)+'；名单学历'+esc(link.proposedHire.degree)+'；仅到'+esc(link.proposedHire.stage)+'。'+(link.sameBatchConfirmed?'同年度招聘程序对应，仍非到岗结果。':'批次尚未闭环，不能算计划完成率。')+(link.plan.note?' '+esc(link.plan.note)+'，不是已留任年限。':'')+'</p>'+sourceLink(link.plan.sourceUrl,'招聘计划')+' '+sourceLink(link.proposedHire.sourceUrl,'拟聘原件')+'</li>').join('');
    const leads=activities.map(lead=>'<li>'+esc(lead.year)+'年 '+esc(lead.stage)+'<p>'+esc(lead.degreeScope)+'；'+esc(lead.majorScope)+'。</p><p>'+esc(lead.conclusion)+'</p>'+sourceLink(lead.source?.url,'活动原件')+(lead.relatedSources||[]).map(source=>' · '+sourceLink(source.url,'历史前置原件，非当次计划')).join('')+'</li>').join('');
    const campaignRows=campaigns.map(item=>'<li><strong>'+esc(item.employer)+'</strong>，发布'+esc(item.publicationYear)+'年；面向'+esc(item.targetCohortYears.join('、'))+'届<p>'+esc(item.acceptedMajorCategories.join('、'))+'；'+esc(item.degreeScope)+'。</p><p>'+esc(item.conclusion)+' 薪酬金额和合同条件未披露。</p>'+sourceLink(item.source?.url,'集团简章正文')+'</li>').join('');
    const ambiguousRows=ambiguous.map(item=>'<li><strong>'+esc(item.position)+'</strong>，'+esc(item.employer)+'<p>'+esc(item.qualificationText)+'</p><p>'+esc(item.conclusion)+'</p>'+sourceLink(item.source?.url,'核对标签与任职正文')+'</li>').join('');
    const caveatRows=caveats.map(item=>'<li><strong>'+esc(item.position)+'</strong><p>'+esc(item.conclusion)+'</p>'+sourceLink(item.source.url,'资格原表 '+item.locator)+'</li>').join('');
    return '<details class="readiness-pathway"><summary>岗位与去向证据：'+roles.length+'个资格样本，'+links.length+'条计划对应，'+activities.length+'条活动线索，'+campaigns.length+'份集团简章，'+ambiguous.length+'条资格待核</summary><p>基础专业：'+esc(qualification?.baseMajor)+'。'+(roles.length||links.length?esc(qualification?.note):'本轮未核到可归属的本科岗位资格；活动线索不证明报名条件已满足。')+'</p>'+(caveatRows?'<h4>必须排除的资格误判</h4><ul>'+caveatRows+'</ul>':'')+(rows?'<h4>岗位与招聘报价</h4><ul>'+rows+'</ul>':'')+(matched?'<h4>名单走到了哪一步</h4><ul>'+matched+'</ul>':'')+(campaignRows?'<h4>历年集团招聘范围，不是本校录用</h4><ul>'+campaignRows+'</ul><p>不同年份同一集团仍是同一雇主组；不能推断同岗持续招聘、录用概率或独立结果交叉验证。</p>':'')+(ambiguousRows?'<h4>专业资格或学历仍待核</h4><ul>'+ambiguousRows+'</ul>':'')+(leads?'<h4>尚待核实的就业渠道</h4><ul>'+leads+'</ul>':'')+(!rows&&!matched&&!leads&&!campaignRows&&!ambiguousRows&&!caveatRows?'<p>本轮尚未补到可归属的岗位资格或活动样本。</p>':'')+'<p>样本数不是市场需求总量；共享计划名额不分摊为本校名额，不据此计算就业率。</p></details>';
  }
  function employerPayPanel(project){
    const leads=project?.employerPayLeads||[];
    if(!leads.length)return '';
    return '<details class="readiness-employer-pay"><summary>企业薪酬原文 · '+leads.length+'条招聘主张，项目资格未核</summary><p>不是本校毕业生实发；不计高薪排序或收入目标达标。</p><ul>'+leads.map(item=>'<li><strong>'+esc(item.employer)+' · '+esc(item.rawQuote)+'</strong><p>发布日期：'+esc(item.publicationDate||'未核')+'；面向'+esc(item.targetCohortYear)+'届；周期：'+(item.period==='year'?'年':item.period==='month'?'月':'未写明，不补成年薪')+'；'+esc(item.taxBasis||'税前税后未披露')+'。</p><p>'+esc(item.experienceScope||'入职与兑现时间未披露')+'；'+esc(item.salaryComposition||'薪酬构成未披露')+'。</p><p>'+esc(item.qualificationScope)+'</p><p>'+esc(item.conclusion)+'</p><a href="'+esc(item.source.url)+'" target="_blank" rel="noopener noreferrer">薪酬原件：'+esc(item.locator)+'</a>'+(item.parentSource?' · <a href="'+esc(item.parentSource.url)+'" target="_blank" rel="noopener noreferrer">所属招聘公告</a>':'')+'</li>').join('')+'</ul></details>';
  }
  function panel(key,detail=false){
    const project=projectFor(key),outcome=project?.historicalOutcome;
    const sources=project?[...new Map([...(outcome?[outcome.source]:[]),...(project.sourceReferences||[])].filter(source=>source?.status==='retrieved'&&(!source.evidenceDisposition||source.evidenceDisposition==='scoped-activity-lead')).map(source=>[source.sourceId,source])).values()]:[];
    const links=detail?sources.slice(0,6).map(source=>'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">官方原件 '+esc(source.sourceId)+'</a>'+(source.parentUrl?' · <a href="'+esc(source.parentUrl)+'" target="_blank" rel="noopener noreferrer">报告原页</a>':'')).join(' · '):'';
    return '<section class="decision-readiness" data-readiness-project="'+esc(key)+'"><'+(detail?'h3':'strong')+'>'+esc(summary(key))+'</'+(detail?'h3':'strong')+'>'+ (project?'<p>'+esc(historical(key))+'</p>':'')+'<p>'+esc(limits(key))+'</p>'+(!detail&&roleSummary(key)?'<p>'+esc(roleSummary(key))+'</p>':'')+(detail&&outcome?'<p>'+esc(outcome.locator)+'；统计截至'+esc(outcome.asOf??'未知')+'。'+esc(outcome.interpretation)+'</p>':'')+(detail?employerPayPanel(project)+pathwayEvidence(project):'')+(links?'<p>'+links+'</p>':'')+(detail?'<p><a href="decision_readiness_30.md" target="_blank" rel="noopener">完整30项审计与检索边界</a> · <a href="decision_readiness_30.json" target="_blank" rel="noopener">结构化审计底稿</a></p>':'')+'</section>';
  }
  window.GAOBAO_DECISION_READINESS={projectFor,salaryFor,salaryEvidenceAudit,summary,historical,limits,panel,roleSummary,hasRoleEvidence};
})();
