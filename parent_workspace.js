/* Reuse the admissions/evidence engine. The profile is local, never an authenticated account. */
(()=>{
  const get=id=>document.getElementById(id),storeKey='zeju-parent-workspace-v1';
  const fieldIds=['score','tuition','degreePlan','salaryTarget','query','sort','institutionFilter','readinessFilter','budget','near','marketOnly'];
  const views=['discover','shortlist','research'];
  const pageSize=()=>window.matchMedia?.('(max-width:560px)').matches?5:12;
  let shown=pageSize(),restoring=false,storageOK=true;
  const money=n=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(n);
  const med=values=>values.length%2?values[(values.length-1)/2]:(values[values.length/2-1]+values[values.length/2])/2;
  const targetDegree=()=>get('degreePlan').value==='graduate'?'硕士':'本科';
  const parentTerms=[
    ['组线','专业组线只用于判断专业组投档位置，不是具体专业最低分，也不是录取概率。'],
    ['工资','工资是同类岗位和学历的公开参考，不是本校本专业毕业生实际工资。'],
    ['名单','拟聘 / 拟录用只表示名单阶段，不等于报到、就业人数或留任。']
  ];
  const parentTermGuide=className=>`<div class="${className||'term-guide'}">${parentTerms.map(([label,text])=>`<p><strong>${esc(label)}：</strong>${esc(text)}</p>`).join('')}</div>`;
  const parentTermSummary='组线不是具体专业最低分；工资不是本校实发；名单不是就业人数。';
  const renameLabels=(host,mapping)=>host?.querySelectorAll('span,dt,strong').forEach(node=>{if(mapping[node.textContent.trim()])node.textContent=mapping[node.textContent.trim()];});
  get('parentTermGuide').innerHTML=parentTerms.map(([label,text])=>`<p><strong>${esc(label)}：</strong>${esc(text)}</p>`).join('');
  const institutionProfiles=new Map((window.GAOBAO_INSTITUTION_PROFILES?.profiles||[]).map(p=>[p.schoolCode,p]));
  const institutionTags=p=>{const row=institutionProfiles.get(p.schoolCode);if(!row)return [];return [row.project985?'历史985':'',row.project211?'历史211':'',row.doubleFirstClass?'双一流':'',/职业/.test(row.schoolLevelType)?row.schoolLevelType:'',row.schoolLevelType==='中外合作大学'?'中外合作':'',row.schoolLevelType==='军队本科院校'?'军队院校':'',...(row.industryDomains||[]).slice(0,2)].filter(Boolean);};
  function enhanceInstitutionTags(){
    for(const card of get('results').querySelectorAll('.choice-card')){
      renameLabels(card,{'2026专业组线':'入学组线参考','工作机会':'同校 / 市场线索','首份工作收入参考':'同类岗位收入'});
      if(card.querySelector('.institution-tags'))continue;
      const p=projects.find(row=>card.getAttribute('aria-label')===row.school+' '+row.major),host=card.querySelector('.choice-school');
      if(!p||!host)continue;
      host.insertAdjacentHTML('afterend',`<div class="institution-tags" aria-label="院校分类">${institutionTags(p).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`);
    }
  }
  const roster=p=>{
    const proposed=batchFacts(p,'拟聘',targetDegree()),accepted=batchFacts(p,'拟录用',targetDegree());
    const card=window.GAOBAO_OPPORTUNITY_BENCHMARK_30?.cards?.[projectKey(p)];
    if(card?.market.schoolMajorObservations){
      for(const [stage,facts] of [['拟聘',proposed],['拟录用',accepted]]){
        facts.school=card.market.schoolMajorObservations.filter(row=>row.stage===stage&&row.degreeBand===targetDegree());
        facts.schoolCount=facts.school.reduce((sum,row)=>sum+row.count,0);
      }
    }
    // Distinct person-row records and stages remain separate; this is not a cohort employment rate.
    return {proposed,accepted};
  };
  function salaryFor(p){
    const base=familyFor(p)?.quality,q=base?.bachelorAlternative&&get('degreePlan').value!=='graduate'?base.bachelorAlternative:base;
    const salary=window.GAOBAO_DECISION_READINESS.salaryFor(projectKey(p));
    if(!salary)throw Error(`缺少工资估计：${projectKey(p)}`);
    return {q,salary,blocked:!!salary.integrityBlocked};
  }
  const salaryText=s=>s.integrityBlocked?'薪酬待核（无来源区间已撤出）':s.period==='month'?`${s.lower/10000}—${s.upper/10000} 万元 / 月`:`${s.lower/10000}—${s.upper/10000} 万元 / 年`;
  const salaryEvidenceLabel=s=>s.integrityBlocked?'无可追溯来源；金额已隐藏':s.evidenceKind==='employer_quote'?'招聘报价 · 不是毕业生实发':s.evidenceKind==='creator_claim'?'博主主张 · 未经独立工资核验':s.evidenceKind==='machine_locator'?'机器定位线索 · 不是工资数字证据':'职业族模型 · 没有直接工资来源';
  const salaryBasis=s=>s.integrityBlocked?'原始数字来源缺失/异常：金额与旧等级已隐藏':`${s.evidenceLabel||s.method} · 旧规则置信度 ${s.grade} ${s.score}/100（非统计置信区间） · ${s.sourceFamilyCount?`${s.sourceFamilyCount}个来源家族`:'无直接数字来源'} · ${s.rankingLimit||'不得直接理解为毕业生工资'}`;
  const salaryScope=s=>s.integrityBlocked?'金额未知，不据此判断收入目标':`${s.degree}首份工作参考；${s.period==='month'?'月度招聘报价/主张，不换算成年薪':'年度综合收入报价/主张'}；不是本校毕业生实际工资`;
  function rankAtScore(score){
    const data=window.GAOBAO_ADMISSION,number=Number(score);
    if(!data||!Number.isInteger(number)||number<data.scoreMin||number>data.scoreMax)return null;
    const rank=data.scoreToCumulativeRank?.[number];
    return Number.isInteger(rank)?rank:null;
  }
  const professionalResult=p=>window.GAOBAO_PROFESSIONAL_RESULTS_2025?.projects?.[projectKey(p)]||null;
  const professionalBands=row=>Object.entries(row.source2025.scoreBandCounts).map(([band,count])=>`${band.replace('-', '—')}分${count}人`).join('、');
  function admissionPosition(p){
    const score=Number(get('score').value),candidateRank=rankAtScore(score),cutoffRank=rankAtScore(p.cutoff);
    const history=window.GAOBAO_ADMISSION_HISTORY?.projects?.[projectKey(p)],historicalYears=Object.entries(history?.years||{}).filter(([year,row])=>Number(year)<2026&&row.status==='strict').map(([year])=>Number(year));
    const professional=professionalResult(p),professionalCutoffAvailable=Number.isInteger(professional?.source2025.exactProfessionalCutoff);
    const status={currentYearRankAvailable:cutoffRank!==null,historicalYears,professionalCutoffAvailable,professionalDistributionAvailable:Boolean(professional),admissionStatus:professionalCutoffAvailable?'professional_result':professional?'professional_distribution_band':historicalYears.length>=2?'historical_group':'current_year_only',largestGap:'缺2022—2025同组历史位次与专业录取结果，不能判断波动、冲稳保或录取概率'};
    if(candidateRank===null||cutoffRank===null)return {candidateRank,cutoffRank,margin:null,status,text:'位次待核；分数不在380—692逐分表内或项目组线缺失，不做区间外推'};
    const margin=cutoffRank-candidateRank,relation=margin>0?`孩子累计位次上界领先组线约 ${money(margin)} 名`:margin===0?'孩子与组线对应同一累计位次上界':`孩子累计位次上界落后组线约 ${money(Math.abs(margin))} 名`;
    return {candidateRank,cutoffRank,margin,status,text:`孩子≤${money(candidateRank)}名；组线≤${money(cutoffRank)}名；${relation}`};
  }
  function admissionEvidenceRead(p){
    const status=admissionPosition(p).status,professional=professionalResult(p),history=window.GAOBAO_ADMISSION_HISTORY?.projects?.[projectKey(p)],strict=Object.entries(history?.years||{}).filter(([year,row])=>Number(year)<2026&&row.status==='strict'),candidates=Object.entries(history?.years||{}).filter(([year,row])=>Number(year)<2026&&row.status==='candidate');
    const ranks=strict.map(([,row])=>row.rankUpperBound).filter(Number.isInteger).sort((a,b)=>a-b),middle=ranks.length?med(ranks):null,spread=ranks.length>=2?Math.round((ranks.at(-1)-ranks[0])/middle*100):null,volatility=spread==null?'':spread<=10?'近年组位次较集中':spread<=20?'近年组位次有一定波动':'近年组位次波动较大';
    const latest=strict.at(-1),current=history?.years?.['2026'],breakPct=latest&&Number.isInteger(current?.rankUpperBound)?Math.round(Math.abs(current.rankUpperBound-latest[1].rankUpperBound)/latest[1].rankUpperBound*100):null;
    if(professional){const source=professional.source2025,group=professional.group2025,strictText=strict.length?`；另有代码＋选科精确匹配${strict.map(([year,row])=>`${year}年≤${money(row.rankUpperBound)}名`).join('、')}`:'',breakText=breakPct>=30?`；历史断裂：2026与最近严格年份位次相差约${breakPct}%，禁止外推`:'',mappingText=professional.mapping.status==='verified_same_named_major'?'跨年按同校同名专业和选科核对':`跨年仅完成受限映射：${professional.mapping.basis}；${professional.mapping.notProven}`;return `2025官方专业统计：录取${source.admittedCount}人（${professionalBands(professional)}）；未公开专业精确最低分。所在${source.groupCode}组共录取${group.admittedCount}人，组最低${group.cutoff}分、≤${money(group.rankUpperBound)}名；2026组号为${professional.current2026.groupCode}，${mappingText}${strictText}${breakText}；不是录取概率`;}
    if(status.admissionStatus==='professional_result')return '已有专业录取结果；仍需核对年份、选科与计划变化';
    if(breakPct>=30)return `历史断裂警示：2026组位次与最近严格匹配的${latest[0]}年相差约${breakPct}%；很可能存在组内专业、计划或录取异常变化，禁止用历史位次外推录取机会`;
    if(status.admissionStatus==='historical_group')return `代码＋选科精确匹配${strict.map(([year,row])=>`${year}年≤${money(row.rankUpperBound)}名`).join('、')}；${volatility}，跨度约占历史中位位次${spread}%；组内专业构成仍待核，不是专业录取概率`;
    if(strict.length)return `仅有代码＋选科精确匹配${strict.map(([year,row])=>`${year}年≤${money(row.rankUpperBound)}名`).join('、')}；不足两年，不能判断波动或冲稳保`;
    if(candidates.length)return `${candidates.map(([year])=>year).join('、')}年存在组号或选科候选映射，尚未通过严格匹配；不进入波动判断`;
    return '当前只取得2026专业组投档位次；未找到可严格连接的2022—2025同组历史和专业录取线';
  }
  function admissionRead(p){
    if(p.cutoff==null)return '暂无可比组线，不能判断分数位置';
    const d=Number(get('score').value)-p.cutoff;
    const scoreRead=d>0?`孩子分数高于组线 ${d} 分`:d===0?'孩子分数与组线相同':`孩子分数低于组线 ${Math.abs(d)} 分`;
    return `${scoreRead}；${admissionPosition(p).text}。累计位次为同分考生位次上界；不是专业录取概率`;
  }
  function projectVerdict(p){
    const f=familyFor(p),state=outlook(p),r=roster(p),s=salaryFor(p).salary;
    if(state.code==='mapping'||p.major.includes('类'))return {tone:'caution',title:'值得核方向',text:'招生名称可能对应多个培养方向，先核课程、分流和岗位资格，再比较就业。'};
    if(p.cutoff!=null&&Number(get('score').value)<p.cutoff)return {tone:'caution',title:'先解决录取风险',text:admissionRead(p)};
    if(s.integrityBlocked)return {tone:'caution',title:'先核工资来源',text:s.notProven};
    if(window.GAOBAO_DECISION_READINESS.projectFor(projectKey(p))?.historicalOutcome)return {tone:'neutral',title:'有历史专业届次指标',text:'已核原报告的专业毕业去向口径；不是纯就业率、未来概率或强推荐。'};
    if(state.code==='repeated')return {tone:'positive',title:'值得进入候选',text:`已有跨${f.metrics.years.length}年、${f.metrics.employerGroups.length}个独立体系的专业相关入口；实际入职和留任仍待核。`};
    if(r.proposed.schoolCount||r.accepted.schoolCount)return {tone:'positive',title:'有同校去向线索',text:'已见拟聘或拟录用记录，但不是报到人数，也不能计算就业率。'};
    if(s.rankingEligible)return {tone:'positive',title:'薪酬材料较可比',text:'有可参与同级比较的薪酬观察，但仍是职业族基线，不是学校工资。'};
    if(state.code==='unreviewed')return {tone:'caution',title:'先补市场证据',text:'目前只能看到方向线索，尚不足以判断本专业是否好就业。'};
    return {tone:'neutral',title:'可作为备选核查',text:'已有部分材料，但规模、竞争或学历门槛仍不完整。'};
  }
  function projectRisk(p){
    const f=familyFor(p),state=outlook(p),s=salaryFor(p).salary,degree=get('degreePlan').value;
    if(p.cutoff!=null&&Number(get('score').value)<p.cutoff)return admissionRead(p);
    if(state.code==='mapping'||p.major.includes('类'))return '培养方向未定，职业族材料不能直接套给孩子。';
    if(s.integrityBlocked)return s.notProven;
    if(degree==='graduate'&&s.degree==='本科')return '页面工资是本科首职基线；研究生工资、升学成本和研究生去向尚未建立。';
    if(!s.rankingEligible)return `工资只是同类岗位的宽区间，${String(s.notProven||'不能据此推出个人实际收入').replace(/[。.!！]+$/,'')}。`;
    if(!f?.metrics.years.length)return '缺少跨年专业相关材料；未覆盖不等于没有机会。';
    return '本校同届毕业分母、实际报到和6/12个月留任仍未核实。';
  }
  function opportunityFor(p){return window.GAOBAO_OPPORTUNITY_BENCHMARK_30?.cards?.[projectKey(p)]||null;}
  function opportunityEvidence(p){
    const c=opportunityFor(p);if(!c)return '';
    const market=c.market,ad=c.admission,sa=salaryFor(p).blocked?null:c.salary;
    const salaryTextValue=sa?`${money(sa.lower/10000)}—${money(sa.upper/10000)} ${sa.period==='month'?'万元/月':'万元/年'}`:'暂无可用区间';
    const degreeText=Object.entries(market.schoolMajorDegreeCounts||{}).map(([degree,count])=>`${degree}${count}条`).join('、');
    const observationDetail=market.schoolMajorRows?`<p>名单观察：${esc((market.schoolMajorObservedYears||[]).join('、'))}年；${esc(degreeText)}；${esc(Object.entries(market.schoolMajorStages||{}).map(([stage,count])=>`${stage}${count}条`).join('、'))}。不是整届就业人数，未证实报到或留任。</p><p>${(market.schoolMajorSourceUrls||[]).map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">官方名单原件${i+1}</a>`).join(' · ')}</p>`:(market.ambiguousSchoolRows?`<p>另有${market.ambiguousSchoolRows}条学校/校区未明确的同名专业线索，未计入本项目直接记录。</p>`:'');
    return `<section class="opportunity-evidence"><h3>首轮机会证据基准</h3><p><strong>${esc(c.conclusion)}</strong></p><div class="opportunity-grid"><div><span>旧基准资料完整度（非本轮等级）</span><b>${esc(c.confidence.grade)}级 · ${c.confidence.score}/100</b><small>不是就业概率</small></div><div><span>专业/行业岗位材料</span><b>${market.officialEvidenceGroups}组</b><small>${esc(market.scope)}</small></div><div><span>本校＋基础专业同名名单观察</span><b>${market.schoolMajorRows}条</b><small>学历与拟聘/拟录用阶段分开</small></div><div><span>薪酬参考</span><b>${esc(salaryTextValue)}</b><small>${sa?esc(sa.grade+'级职业族参考'):'暂无区间'}</small></div></div>${observationDetail}<p class="opportunity-boundary">${esc(c.boundaries.join('；'))}</p><p><a href="?view=research" data-benchmark-project="${esc(c.projectKey)}">查看30个基准专业的方法说明</a></p></section>`;
  }
  function salaryEvidenceOnly(p){
    const s=salaryFor(p).salary,library=window.GAOBAO_SALARY,rows=s.sourceIds.map(id=>library.observations.find(x=>x.id===id)).filter(Boolean);
    const links=rows.length?rows.map(x=>`<li><strong>${esc(x.sourceType==='job_ad'?'招聘报价':x.sourceType==='human_reviewed_case'?'人工复核个案':x.sourceType==='creator_title'?'博主标题/画面主张':'视频定位线索')}</strong>：${esc(x.quote||x.role||x.id)}${x.sourceUrl?` <a href="${esc(x.sourceUrl)}" target="_blank" rel="noreferrer">核对来源</a>`:''}</li>`).join(''):'<li>当前没有可直接引用的同岗位数字，使用职业族宽区间；这一级只负责避免空白，不参与高薪排序。</li>';
    if(s.integrityBlocked)return `<section class="salary-detail"><h3>首份工作收入参考：薪酬待核</h3><p>${esc(s.notProven)}</p><p>不展示旧区间及旧等级，不用于判断收入目标。</p></section>`;
    return `<section class="salary-detail"><h3>首份工作收入参考：${esc(salaryText(s))}</h3><p><span class="salary-grade grade-${esc(s.grade)}">${esc(s.grade)}级 · ${s.score}/100</span> ${esc(s.method)}。${esc(s.scope)}。</p><dl><div><dt>口径</dt><dd>${esc(salaryScope(s))}；${esc(s.experience)}；税前税后${esc(s.taxBasis)}</dd></div><div><dt>最大偏差风险</dt><dd>${esc(s.largestRisk)}</dd></div><div><dt>不能推出</dt><dd>${esc(s.notProven)}</dd></div></dl><h4>进入本区间的材料</h4><ul>${links}</ul></section>`;
  }
  function admission(p){return p.cutoff==null?'组线未知':`组线 ${p.cutoff} 分 / 分差 ${Number(get('score').value)-p.cutoff>=0?'+':''}${Number(get('score').value)-p.cutoff} 分`;}
  function admissionGlance(p){
    if(p.cutoff==null)return {tone:'unknown',label:'入学位置待核',note:'暂无可比专业组线'};
    const diff=Number(get('score').value)-p.cutoff;
    if(diff<0)return {tone:'risk',label:`低于组线 ${Math.abs(diff)} 分`,note:`2026专业组线 ${p.cutoff} 分`};
    if(diff<=15)return {tone:'near',label:diff===0?'与组线相同':`高于组线 ${diff} 分`,note:`2026专业组线 ${p.cutoff} 分`};
    return {tone:'room',label:`高于组线 ${diff} 分`,note:`2026专业组线 ${p.cutoff} 分`};
  }
  function evidenceGlance(key,f,r){
    if(r.proposed.schoolCount||r.accepted.schoolCount)return {title:'有同校专业名单线索',note:'只到拟聘 / 拟录用，未证实报到和留任'};
    if(window.GAOBAO_DECISION_READINESS.hasRoleEvidence(key))return {title:'有专业岗位资格原文',note:'能确认岗位入口，不能当作本校就业率'};
    if(f?.metrics.years.length)return {title:`有${f.metrics.years.length}年相关招聘材料`,note:'能确认市场出现过，规模和竞争仍待核'};
    return {title:'目前只有职业方向线索',note:'本校就业结果和市场岗位都需要继续核实'};
  }
  function evidenceLine(p){
    const f=familyFor(p),r=roster(p),years=f?.metrics.years||[];
    const auditedProject=window.GAOBAO_DECISION_READINESS.projectFor(projectKey(p)),qualification=auditedProject?.qualificationRequirements;
    if(qualification?.requirements?.length||qualification?.recruitmentLinks?.length)return '已有基础专业岗位样本；尚需补齐项目适用资格、跨年独立雇主和实际就业结果。';
    if(auditedProject?.campaignEvidence?.length)return '已有集团跨年招聘范围原文；具体岗位资格、目标学校录用及实际工资仍待核，不能当作同岗持续招聘。';
    if(auditedProject?.ambiguousRoleLeads?.length)return '已有相关岗位原文，但专业标签与任职条件不完全一致；资格未确认。';
    if(auditedProject?.activityLeads?.length)return '已有学校招聘活动或校企接洽原文；具体岗位资格、薪资和实际录用仍须分别核实，活动不计岗位样本。';
    if(window.GAOBAO_DECISION_READINESS.projectFor(projectKey(p))?.historicalOutcome)return '本轮已核历史专业届次指标；招聘入口、实际工资与到岗留任仍需分别补证';
    if(r.proposed.schoolCount||r.accepted.schoolCount)return `同校同专业：${[['拟聘',r.proposed.schoolCount],['拟录用',r.accepted.schoolCount]].map(([stage,count])=>`${stage}${count?count+'条已见记录':'未覆盖'}`).join(' / ')}；届次与分母未确认`;
    if(years.length)return `${years.join('、')}年有关联职业原文；本校同专业真实就业结果仍待核`;
    return '当前职业线索还缺市场原文支持；不能判定为不好就业';
  }
  function evidenceGaps(p){
    const f=familyFor(p),r=roster(p),s=salaryFor(p).salary,state=outlook(p),admissionState=admissionPosition(p).status,gaps=[];
    const history=window.GAOBAO_ADMISSION_HISTORY?.projects?.[projectKey(p)],strict=Object.entries(history?.years||{}).filter(([year,row])=>Number(year)<2026&&row.status==='strict'),latest=strict.at(-1),current=history?.years?.['2026'],breakPct=latest&&Number.isInteger(current?.rankUpperBound)?Math.round(Math.abs(current.rankUpperBound-latest[1].rankUpperBound)/latest[1].rankUpperBound*100):null;
    if(breakPct>=30)gaps.push({code:'admission_break',label:'历史断裂',task:`2026组位次与最近严格匹配年份相差约${breakPct}%；优先核组内专业、招生计划、征集/补录或统计异常，核清前禁止外推`,priority:0});
    if(admissionState.admissionStatus==='professional_distribution_band')gaps.push({code:'professional_cutoff',label:'专业录取线',task:'已有2025专业录取人数与10分档，但缺精确专业最低分；还需核对跨年专业计划、组内构成和专业热度变化',priority:1});
    else if(admissionState.admissionStatus==='current_year_only')gaps.push({code:'admission',label:'录取波动',task:admissionState.largestGap,priority:1});
    else if(admissionState.admissionStatus==='historical_group')gaps.push({code:'admission_composition',label:'跨年组内构成',task:'已有学校代码、组号和选科精确匹配，但仍需核对各年组内是否包含同一专业及招生计划变化',priority:1});
    const professional=professionalResult(p),limitedMapping=professional&&professional.mapping.status!=='verified_same_named_major';
    if(limitedMapping||state.code==='mapping'||p.major.includes('类'))gaps.push({code:'cultivation',label:'培养映射',task:limitedMapping?professional.mapping.notProven:'核对课程、专业分流、培养方向与目标岗位资格，不能把相邻专业直接等同',priority:2});
    if(!f?.metrics.years.length)gaps.push({code:'market',label:'职业市场',task:'补至少两个年份、两个独立雇主的专业相关岗位原文，并记录学历、地点和资格门槛',priority:3});
    const historical=window.GAOBAO_DECISION_READINESS.projectFor(projectKey(p))?.historicalOutcome;
    gaps.push(historical?{code:'school_outcome',label:'历史结果边界',task:`已核${historical.cohortYear}届${historical.indicator}；仍缺报到、留任及独立第二来源，不能外推未来就业概率`,priority:4}:!r.proposed.schoolCount&&!r.accepted.schoolCount?{code:'school_outcome',label:'学校结果',task:'补同校同专业逐届毕业、升学、签约、拟聘、拟录用和报到的匿名汇总；各阶段分开',priority:4}:{code:'school_outcome',label:'结果分母',task:'已有名单线索，但缺同届毕业分母、报到人数及未就业去向，不能计算就业率',priority:4});
    gaps.push(!s.rankingEligible?{code:'salary',label:'工资结果',task:'当前仅有宽口径职业族区间；补同岗位、同学历、同地区可核报价或毕业生实际工资',priority:5}:{code:'salary',label:'校级工资',task:'职业族工资可比较，但缺本校本专业毕业生实际工资分布',priority:5});
    gaps.push({code:'retention',label:'到岗留任',task:'补实际到岗、6个月和12个月留任；不得用招聘、拟聘或拟录用人数替代',priority:6});
    if(hardships(p).length||state.code==='mapping')gaps.push({code:'qualification',label:'资格限制',task:`逐岗核对体检、证书、生源、学历和工作条件${hardships(p).length?'；当前线索含'+hardships(p).join('、'):''}`,priority:7});
    return gaps.sort((a,b)=>a.priority-b.priority);
  }
  function salaryEvidence(p){return window.GAOBAO_DECISION_READINESS.panel(projectKey(p),true)+opportunityEvidence(p)+salaryEvidenceOnly(p);}
  window.parentProjectCard=p=>{
    const key=projectKey(p),f=familyFor(p),r=roster(p),pay=salaryFor(p),s=pay.salary,q=jobQuality(p,salaryExpectation(),get('degreePlan').value);
    const jobs=r.proposed.schoolCount||r.accepted.schoolCount?'有同校专业拟聘 / 拟录用记录':window.GAOBAO_DECISION_READINESS.hasRoleEvidence(key)?'有基础专业岗位原件；结果待补':f?.metrics.years.length?'有专业相关招聘入口':'就业结果待补';
    const stable=pay.q?.stability;
    const shortStable=!stable?'实际稳定性未知':/五险/.test(stable)?'招聘列明五险一金':'已有用工条件线索';
    const salary=salaryText(s);
    const verdict=projectVerdict(p),risk=projectRisk(p),gap=evidenceGaps(p)[0];
    const fit=admissionGlance(p),proof=evidenceGlance(key,f,r);
    const stabilityNote=stable?pay.q.risk:hardships(p).length?`可能涉及${hardships(p).join('、')}，具体岗位待核`:'合同、实际报到与留任没有可比数据';
    return `<article class="choice-card" aria-label="${esc(p.school+' '+p.major)}"><div class="choice-top"><div><div class="choice-school">${esc(p.school)}<small>${esc(p.region)}</small></div><h3 class="choice-major">${esc(p.major)}</h3><p class="choice-decision ${f?.metrics.years.length?'known':''}">${esc(decision(p,get('degreePlan').value))}</p></div><div class="choice-fit ${fit.tone}"><span>入学位置</span><strong>${esc(fit.label)}</strong><small>${esc(fit.note)}</small></div></div><div class="choice-summary ${verdict.tone==='caution'?'caution':''}"><span>这项为什么值得看</span><strong>${esc(verdict.title)}</strong><p>${esc(verdict.text)}</p></div><dl class="choice-answers"><div><dt>毕业后可能去哪</dt><dd>${esc(q.role)}<small>${esc(jobs)}</small></dd></div><div><dt>同类岗位收入</dt><dd>${salary}<small>${esc(s.degree)}首职 · ${esc(salaryEvidenceLabel(s))}</small></dd></div><div><dt>稳定性</dt><dd class="${!stable?'unknown':''}">${shortStable}<small>${esc(stabilityNote)}</small></dd></div><div class="answer-risk"><dt>先确认的代价</dt><dd>${esc(risk)}</dd></div></dl><div class="choice-bottom"><div class="choice-proof"><strong>${esc(proof.title)}</strong><span>${esc(proof.note)}</span><span class="choice-gap">下一步先核：${esc(gap.label)}</span></div><div class="choice-actions"><label class="compare-pick"><input type="checkbox" data-compare="${esc(key)}" ${comparison.has(key)?'checked':''}>加入对比<span class="sr-only">：${esc(p.school+' '+p.major)}</span></label><a href="?project=${encodeURIComponent(key)}" data-project="${esc(key)}" aria-label="查看${esc(p.school+' '+p.major)}为什么值得关注、完整口径和原文">查看为什么</a></div></div></article>`;
  };
  function renderFamily(){
    window.ZEJU_FAMILY?.render([...comparison].map(key=>projects.find(project=>projectKey(project)===key)).filter(Boolean).map(project=>({key:projectKey(project),school:project.school,major:project.major,reason:projectVerdict(project).title+'：'+projectVerdict(project).text,risk:projectRisk(project),admission:admissionRead(project),evidence:window.GAOBAO_DECISION_READINESS.summary(projectKey(project)),gap:evidenceGaps(project).map(item=>item.label+'：'+item.task)[0]||'待核',hardships:hardships(project)})));
  }
  window.parentComparison=()=>{
    renderFamily();
    const choices=[...comparison].map(key=>projects.find(p=>projectKey(p)===key)).filter(Boolean);
    if(!choices.length){get('compareBody').innerHTML='<div class="comparison-empty"><h3>还没有放入对比的学校与专业</h3><p>回到清单，选择2—4项。先比较孩子能否进入，再比较毕业后的选择。</p><a href="?view=discover" data-view="discover">去选学校与专业</a></div>';return;}
    const fields=[['本轮深核范围与等级',p=>window.GAOBAO_DECISION_READINESS.summary(projectKey(p))],['历史届次指标（不是就业概率）',p=>window.GAOBAO_DECISION_READINESS.historical(projectKey(p))],['推荐边界',p=>window.GAOBAO_DECISION_READINESS.limits(projectKey(p))],['为什么保留',p=>projectVerdict(p).title+'：'+projectVerdict(p).text],['主要风险',projectRisk],['入学分数与位次参考',admissionRead],['录取证据状态',admissionEvidenceRead],['按当前家庭条件',p=>currentRows.some(x=>projectKey(x)===projectKey(p))?'符合当前清单条件':'当前清单未命中；请核查分数、选科、预算或搜索条件'],['学费 / 年',p=>typeof p.tuition==='number'?money(p.tuition)+'元':'待核'],['可以了解的职业',p=>jobQuality(p,salaryExpectation(),get('degreePlan').value).role],['孩子的路径判断',p=>decision(p,get('degreePlan').value)],['同校同专业的公开结果',p=>{const r=roster(p);return `${targetDegree()}：${r.proposed.schoolCount||'未覆盖'}${r.proposed.schoolCount?'条':''}拟聘 / ${r.accepted.schoolCount||'未覆盖'}${r.accepted.schoolCount?'条':''}拟录用；报到、留任与就业率待核。`; }],['首份工作收入参考',p=>{const s=salaryFor(p).salary;return `${salaryText(s)}；${salaryScope(s)}；${salaryBasis(s)}；${s.largestRisk}`;}],['稳定性与代价',p=>jobQuality(p,salaryExpectation(),get('degreePlan').value).stability+'；'+jobQuality(p,salaryExpectation(),get('degreePlan').value).risk],['证据缺口',p=>evidenceGaps(p).map(x=>x.label+'：'+x.task).join('；')]];
    const sameSchoolOutcome=choices.filter(p=>{const r=roster(p);return r.proposed.schoolCount||r.accepted.schoolCount;}).length;
    const comparableSalary=choices.filter(p=>salaryFor(p).salary.rankingEligible).length;
    const quick=choices.map(p=>{
      const key=projectKey(p),v=projectVerdict(p),s=salaryFor(p).salary,q=jobQuality(p,salaryExpectation(),get('degreePlan').value),r=roster(p);
      const opportunity=r.proposed.schoolCount||r.accepted.schoolCount?'有同校专业名单线索':window.GAOBAO_DECISION_READINESS.hasRoleEvidence(key)?'有专业岗位资格原文':familyFor(p)?.metrics.years.length?'有专业相关招聘材料':'本校就业结果待补';
      const stability=salaryFor(p).q?.stability?(/五险/.test(salaryFor(p).q.stability)?'招聘列明五险一金':'已有用工条件线索'):'实际稳定性未核';
      return `<article class="compare-brief"><small>${esc(p.school)}</small><h3>${esc(p.major)}</h3><p class="compare-brief-admission"><strong>入学参考</strong>${esc(p.cutoff==null?'专业组线待核':`2026专业组线 ${p.cutoff} 分`)}</p><dl><div><dt>工作方向</dt><dd>${esc(q.role)}</dd></div><div><dt>工作机会</dt><dd>${esc(opportunity)}</dd></div><div><dt>收入参考</dt><dd>${esc(salaryText(s))}</dd></div><div><dt>稳定性</dt><dd>${esc(stability)}</dd></div><div><dt>为什么保留</dt><dd>${esc(v.title)}</dd></div><div class="compare-risk"><dt>最需要担心</dt><dd>${esc(projectRisk(p))}</dd></div></dl><p class="compare-brief-evidence"><strong>材料把握：</strong>${esc(window.GAOBAO_DECISION_READINESS.summary(key))}</p><p class="compare-brief-limit"><strong>边界：</strong>${esc(window.GAOBAO_DECISION_READINESS.limits(key))}</p><div class="compare-brief-actions"><a href="?project=${encodeURIComponent(projectKey(p))}" data-project="${esc(projectKey(p))}">查看依据</a><button type="button" class="text-button" data-remove="${esc(key)}" aria-label="从对比中移除${esc(p.school+' '+p.major)}">移除</button></div></article>`;
    }).join('');
    get('compareBody').innerHTML=`<div class="compare-guide"><strong>先排除不能接受的工作方式，再比较收入和材料把握。</strong><span>${choices.length}项中，${sameSchoolOutcome}项有同校专业名单线索，${comparableSalary}项有可用于横向比较的工资材料。</span></div><div class="compare-briefs">${quick}</div><details class="compare-details"><summary>需要更细时，展开完整逐项对比</summary><div class="table-scroll"><table class="compare-table"><caption class="sr-only">按当前条件比较${choices.length}个学校专业；组线不是录取概率</caption><thead><tr><th scope="col">考量因素</th>${choices.map(p=>`<th scope="col">${esc(p.school)}<span class="compare-major">${esc(p.major)}</span></th>`).join('')}</tr></thead><tbody>${fields.map(([name,fn])=>`<tr><th scope="row">${esc(name)}</th>${choices.map(p=>`<td>${esc(fn(p))}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">查看 / 移除</th>${choices.map(p=>`<td><a href="?project=${encodeURIComponent(projectKey(p))}" data-project="${esc(projectKey(p))}">查看职业与证据</a><br><button type="button" class="text-button" data-remove="${esc(projectKey(p))}">移除<span class="sr-only"> ${esc(p.school+' '+p.major)}</span></button></td>`).join('')}</tr></tbody></table></div></details>`;
    renameLabels(get('compareBody'),{'入学参考':'入学组线参考','工作机会':'同校 / 市场线索','收入参考':'同类岗位收入'});
    get('compareBody').querySelector('.compare-guide')?.insertAdjacentHTML('beforeend',`<small>${esc(parentTermSummary)}</small>`);
  };
  function persist(){
    if(restoring)return;
    const fields=Object.fromEntries(fieldIds.map(id=>[id,get(id).type==='checkbox'?get(id).checked:get(id).value]));
    try{localStorage.setItem(storeKey,JSON.stringify({fields,subjects:[...document.querySelectorAll('#subjects input:checked')].map(x=>x.value),conditions:[...document.querySelectorAll('#conditions input:checked')].map(x=>x.value),choices:[...comparison]}));get('profileSaveStatus').textContent='条件与对比已保存到本机浏览器';}catch{storageOK=false;get('profileSaveStatus').textContent='浏览器无法保存；本次条件与对比仍可使用';}
  }
  function syncURL(){
    const url=new URL(location.href);
    url.searchParams.set('profileMode',window.ZEJU_FAMILY?.mode()||'demo');
    if(window.ZEJU_FAMILY?.mode()==='mine')url.searchParams.set('workConditions',window.ZEJU_FAMILY.conditionValues());else url.searchParams.delete('workConditions');
    for(const id of ['score','query','sort','institutionFilter','readinessFilter','degreePlan','tuition','salaryTarget'])url.searchParams.set(id,get(id).value);
    url.searchParams.set('subjects',[...document.querySelectorAll('#subjects input:checked')].map(x=>x.value).join(','));
    url.searchParams.set('conditions',[...document.querySelectorAll('#conditions input:checked')].map(x=>x.value).join(','));
    for(const id of ['budget','near','marketOnly'])url.searchParams.set(id,get(id).checked?'1':'0');
    history.replaceState(null,'',url);
  }
  window.syncParentWorkspace=(invalid=false)=>{
    invalid=invalid||get('scope').textContent.startsWith('请输入');
    get('familySummary').textContent=`北京 · ${get('score').value||'未填'}分 · ${[...document.querySelectorAll('#subjects input:checked')].map(x=>x.value).join(' / ')||'未选择选科'} · ${get('degreePlan').selectedOptions[0].text}`;
    get('scoreError').textContent=get('score').value===''||!Number.isFinite(Number(get('score').value))||Number(get('score').value)<0||Number(get('score').value)>750?'请输入0—750之间的分数。':'';
    get('score').setAttribute('aria-invalid',get('scoreError').textContent?'true':'false');
    document.body.classList.toggle('profile-incomplete',invalid||!get('score').value||![...document.querySelectorAll('#subjects input:checked')].length);
    get('savedCount').textContent=comparison.size;
    get('mobileSavedCount').textContent=comparison.size;
    const mobileCompare=document.querySelector('.mobile-compare-bar');
    mobileCompare.hidden=comparison.size===0;
    mobileCompare.querySelector('strong').textContent=comparison.size===1?'再选1项更好比较':'查看对比';
    get('loadMore')?.remove();
    const cards=[...get('results').querySelectorAll('.choice-card')];cards.forEach((c,i)=>{c.hidden=i>=shown;c.dataset.resultOrder=String(i+1);});enhanceInstitutionTags();
    if(!invalid&&cards.length)get('scope').textContent=`找到${cards.length}个候选，先看前${Math.min(shown,cards.length)}个；排序用于减少浏览，不是学校排名。`;
    if(cards.length>shown){const step=pageSize();get('results').insertAdjacentHTML('afterend',`<button type="button" class="load-more" id="loadMore">再看${Math.min(step,cards.length-shown)}个项目（共${cards.length}个）</button>`);get('loadMore').addEventListener('click',()=>{shown+=step;window.syncParentWorkspace();});}
    if(!invalid&&!cards.length){
      const auditScope=get('readinessFilter').value,limitedScope=auditScope!=='all';
      get('results').innerHTML=`<div class="empty"><strong>这个条件下，暂时没有匹配项目。</strong><p>${limitedScope?'当前审计范围：'+esc(get('readinessFilter').selectedOptions[0].text)+'。可先恢复全部审计范围；分数、选科、预算和其他条件保持不变。':'可以清空搜索词，或检查分数、选科与预算是否填写准确。'}当前只是北京部分招生项目，不代表全国没有选择。</p>${limitedScope?'<button type="button" class="secondary-button" id="resetReadinessFilter">恢复全部审计范围</button> ':''}<button type="button" class="secondary-button" id="clearSearch">清空搜索词</button> <button type="button" class="secondary-button" data-view="research">查看信息覆盖范围</button></div>`;
    }
    if(!invalid||window.ZEJU_FAMILY?.mode()==='mine'){persist();syncURL();}
    if(invalid)renderFamily();
    if(invalid)get('profileSaveStatus').textContent=window.ZEJU_FAMILY?.mode()==='mine'?'请补齐或修正输入；未完成档案与讨论仍保留在本机（保存失败时除外）':'请修正输入；此前保存的条件与对比仍保留';
  };
  function showView(view,focus=false){
    if(!views.includes(view))view='discover';
    for(const name of views)get(name+'View').hidden=name!==view;
    // Research content lives inside a collapsed disclosure. Deep links from
    // a project must reveal the actual target instead of scrolling to hidden
    // controls; opening it when the research view is selected is also clearer
    // for keyboard and screen-reader users.
    if(view==='research')document.querySelector('.research-workbench')?.setAttribute('open','');
    document.querySelectorAll('nav [data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState(null,'',url);
    if(focus)get(view==='discover'?'discoverHeading':view==='shortlist'?'shortlistHeading':'researchHeading').focus({preventScroll:false});
  }
  function detail(p){
    const f=familyFor(p),r=roster(p),degree=targetDegree(),records=[...r.proposed.school,...r.accepted.school],gaps=evidenceGaps(p),professional=professionalResult(p);
    get('projectDialogTitle').textContent=p.school+' · '+p.major;
    get('projectDialogBody').innerHTML=`<section class="detail-overview"><h3>先看：公开材料能确认到哪一步？</h3><p><strong>录取位置：</strong>${esc(admissionRead(p))}</p><p><strong>录取证据：</strong>${esc(admissionEvidenceRead(p))}</p><div class="detail-rosters"><div>同校同专业${esc(degree)}拟聘<strong>${r.proposed.schoolCount?r.proposed.schoolCount+'条记录':'未覆盖'}</strong></div><div>同校同专业${esc(degree)}拟录用<strong>${r.accepted.schoolCount?r.accepted.schoolCount+'条记录':'未覆盖'}</strong></div><div>实际报到 / 6、12个月留任<strong>未核实</strong></div></div><p>名单是历史公开记录，材料年份不等于毕业届次。这些名单缺少同届毕业分母，不能据此计算就业率；另有原报告届次指标时见本轮审计，口径不混用。未覆盖不等于无人就业。</p><div class="detail-links"><a href="?view=research" data-factor-project="${esc(projectKey(p))}">查看逐因子量化解释</a><a href="?view=research" data-career-topic="${esc(p.candidateIds[0])}">查看相关职业资料</a></div></section>${window.ZEJU_PATHWAYS?.panel(projectKey(p))||''}<section class="detail-evidence-gaps"><h3>这个项目还缺什么证据？</h3><ol>${gaps.map(x=>`<li><strong>${esc(x.label)}</strong>：${esc(x.task)}</li>`).join('')}</ol></section>${window.ZEJU_LEARNING?.program(projectKey(p))||''}${salaryEvidence(p)}${records.length?`<section class="detail-roster-list"><h3>同校同专业记录的去向</h3>${records.slice(0,12).map(x=>`<div class="record"><strong>${esc(x.employerCanonical||x.employerGroup||'原文用人单位')} · ${esc(x.stage)}</strong><p>${esc(x.year||'未知')}年材料；毕业届次${esc(x.cohortYear??'未知')}；${esc(x.degreeBand)}；${esc(x.positionCanonical||'岗位未单独列明')}</p><a href="${esc(x.sourceUrl)}" target="_blank" rel="noreferrer">核对原始名单</a><p>${esc(x.countScope)}</p></div>`).join('')}</section>`:''}${detailCard({...p,m:merged(p),f,diff:p.cutoff==null?null:Number(get('score').value)-p.cutoff,outlook:outlook(p),coverage:f?.metrics.coverageScore??null,band:band(p.cutoff==null?null:Number(get('score').value)-p.cutoff)})}`;
    get('projectDialogBody').querySelector('.detail-overview h3')?.insertAdjacentHTML('afterend',parentTermGuide('term-guide detail-term-guide'));
    if(professional)get('projectDialogBody').querySelector('.detail-overview h3').insertAdjacentHTML('afterend',`<p><a href="${esc(window.GAOBAO_PROFESSIONAL_RESULTS_2025.source.url)}" target="_blank" rel="noreferrer">核对北京教育考试院原表</a>（PDF第${professional.verification.pdfPageNumber}页，书内第${professional.verification.printedPageNumber}页；已人工图像复核）</p>`);
    if(!get('projectDialog').open)get('projectDialog').showModal();
    const url=new URL(location.href);url.searchParams.set('project',projectKey(p));history.replaceState(null,'',url);
  }
  function closeDetail(){get('projectDialog').close();const url=new URL(location.href);url.searchParams.delete('project');history.replaceState(null,'',url);}
  function readState(){
    restoring=true;
    try{
      const state=JSON.parse(localStorage.getItem(storeKey)||'null');
      if(state){for(const id of fieldIds){if(state.fields?.[id]!==undefined){if(get(id).type==='checkbox')get(id).checked=state.fields[id]===true;else get(id).value=String(state.fields[id]);}}
        for(const [id,values] of [['subjects',state.subjects],['conditions',state.conditions]])if(Array.isArray(values))document.querySelectorAll('#'+id+' input').forEach(x=>x.checked=values.includes(x.value));
        if(Array.isArray(state.choices))state.choices.filter(key=>projects.some(p=>projectKey(p)===key)).slice(0,4).forEach(key=>comparison.add(key));
      }
    }catch{storageOK=false;}
    const params=new URL(location.href).searchParams;
    for(const id of ['score','query','sort','institutionFilter','readinessFilter','degreePlan','tuition','salaryTarget'])if(params.has(id))get(id).value=params.get(id);
    for(const [id,key] of [['subjects','subjects'],['conditions','conditions']])if(params.has(key))document.querySelectorAll('#'+id+' input').forEach(x=>x.checked=params.get(key).split(',').includes(x.value));
    for(const id of ['budget','near','marketOnly'])if(params.has(id))get(id).checked=params.get(id)==='1';
    if(window.matchMedia?.('(max-width:560px)').matches&&!params.has('query'))get('query').value='';
    if(!['all','audited','outside'].includes(get('readinessFilter').value))get('readinessFilter').value='all';
    window.ZEJU_FAMILY?.restore();
    restoring=false;
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-view],[data-project],[data-factor-project],[data-career-topic]');
    if(link&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;
    if(link?.dataset.view){event.preventDefault();showView(link.dataset.view,true);}
    if(link?.dataset.project){event.preventDefault();const p=projects.find(p=>projectKey(p)===link.dataset.project);if(p)detail(p);}
    if(link?.dataset.factorProject){event.preventDefault();closeDetail();showView('research');get('factorProject').value=link.dataset.factorProject;renderFactors();document.getElementById('factorHeading').scrollIntoView({block:'start'});}
    if(link?.dataset.careerTopic){event.preventDefault();if(get('projectDialog').open)closeDetail();showView('research');window.openCareerTopic?.(link.dataset.careerTopic);get('contentHeading').scrollIntoView({block:'start'});}
    if(event.target.id==='clearSearch'){get('query').value='';shown=pageSize();render();get('query').focus();}
    if(event.target.id==='resetReadinessFilter'){get('readinessFilter').value='all';shown=pageSize();render();get('readinessFilter').focus();}
  });
  document.addEventListener('change',event=>{
    const key=event.target.dataset.compare;
    if(!key)return;
    if(event.target.checked&&comparison.size>=4&&!comparison.has(key)){event.target.checked=false;get('compareMessage').textContent='最多比较4项，请先移除一项。';get('workspaceStatus').textContent='最多比较4项，请先移除一项。';return;}
    event.target.checked?comparison.add(key):comparison.delete(key);
    document.querySelectorAll('[data-compare]').forEach(x=>x.checked=comparison.has(x.dataset.compare));
    get('compareMessage').textContent='';get('workspaceStatus').textContent=event.target.checked?'已加入对比':'已移出对比';renderComparison();window.syncParentWorkspace();
  });
  get('closeProject').addEventListener('click',closeDetail);
  get('projectDialog').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&get('projectDialog').open){event.preventDefault();closeDetail();}
  });
  // Native printing must include the full comparison even when its disclosure is closed.
  let printDetails=[];
  function preparePrint(){
    if(printDetails.length)return;
    printDetails=[...document.querySelectorAll('.compare-details, #familyDecision .professional-paths details')].map(node=>({node,open:node.open}));
    printDetails.forEach(({node})=>node.open=true);
  }
  window.addEventListener('beforeprint',preparePrint);
  window.addEventListener('afterprint',()=>{printDetails.forEach(({node,open})=>node.open=open);printDetails=[];});
  get('printChoices').addEventListener('click',()=>{preparePrint();window.print();});
  get('editProfile').addEventListener('click',()=>{get('familyProfile').scrollIntoView({block:'start'});get('score').focus({preventScroll:true});});
  get('run').addEventListener('click',()=>{shown=pageSize();render();showView('discover');if(get('scoreError').textContent)get('score').focus();else get('discoverHeading').focus();});
  get('resetFilters').addEventListener('click',()=>{
    window.ZEJU_FAMILY?.demo();
    for(const [id,value] of Object.entries({score:'550',tuition:'30000',degreePlan:'bachelor',salaryTarget:'8',query:'',sort:'signal',institutionFilter:'all',readinessFilter:'all'}))get(id).value=value;
    document.querySelectorAll('#subjects input').forEach(x=>x.checked=['物理','化学'].includes(x.value));document.querySelectorAll('#conditions input').forEach(x=>x.checked=true);
    get('budget').checked=true;get('near').checked=false;get('marketOnly').checked=false;shown=pageSize();render();get('workspaceStatus').textContent='已恢复演示条件；不代表学生意愿，对比与讨论记录仍保留';
  });
  for(const id of fieldIds)get(id).addEventListener('input',()=>{shown=pageSize();window.syncParentWorkspace(!!get('scoreError').textContent);});
  window.addEventListener('popstate',()=>{readState();render();showView(new URL(location.href).searchParams.get('view')||'discover');const id=new URL(location.href).searchParams.get('project'),p=projects.find(p=>projectKey(p)===id);if(p)detail(p);else if(get('projectDialog').open)closeDetail();});
  // Native labels/name attributes also cover inherited research controls.
  document.querySelectorAll('input[id],select[id]').forEach(x=>{if(!x.name)x.name=x.id;if(x.type!=='checkbox'&&!x.autocomplete)x.autocomplete='off';});
  readState();const initial=new URL(location.href);render();showView(initial.searchParams.get('view')||'discover');
  const initialProject=projects.find(p=>projectKey(p)===initial.searchParams.get('project'));if(initialProject)detail(initialProject);
  if(!storageOK)get('profileSaveStatus').textContent='本机保存不可用；本次仍可查看与对比';
  window.GAOBAO_ADMISSION_API={rankAtScore,admissionPosition,admissionEvidenceRead,evidenceGaps};
})();
