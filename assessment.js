// Rule scores express preferences over observations, never employment probabilities.
(function(root){
  'use strict';
  const VERSION='factor-v1.1-2026-10-02';
  const WINDOW=[2022,2023,2024,2025,2026];
  const known=r=>r.verified&&r.p0&&r.majorMatched;
  function weightedBounds(factors,weights={}){
    let total=0,lower=0,upper=0,covered=0;
    for(const f of factors){
      const w=weights[f.id]??f.weight;
      if(!Number.isFinite(w)||w<0)throw Error('Invalid weight: '+f.id);
      total+=w;
      if(f.score===null){upper+=w*100;continue;}
      const [lo,hi]=Array.isArray(f.score)?f.score:[f.score,f.score];
      if(![lo,hi].every(Number.isFinite)||lo<0||hi>100||lo>hi)throw Error('Invalid factor: '+f.id);
      lower+=w*lo;upper+=w*hi;covered+=w;
    }
    if(!total)return {lower:null,upper:null,coverage:0,complete:false};
    return {lower:lower/total,upper:upper/total,coverage:100*covered/total,complete:covered===total&&lower===upper};
  }
  function robustOrder(a,b,sameScope=false){
    if(!sameScope)return '口径未匹配，无法比较';
    if(a.lower===null||b.lower===null)return '无法比较';
    if(a.lower>b.upper)return 'A在当前规则下稳健领先';
    if(b.lower>a.upper)return 'B在当前规则下稳健领先';
    return '区间重叠，不能判定优劣';
  }
  function cohortBounds(c){
    if(!c||!Number.isInteger(c.graduates)||c.graduates<=0)return null;
    const keys=['employed','furtherStudy','notEmployed','outsideLabour','unknown'];
    if(keys.some(k=>!Number.isInteger(c[k])||c[k]<0)||keys.reduce((s,k)=>s+c[k],0)!==c.graduates)return null;
    if(!c.sameCohort||!c.deduplicated||!c.mutuallyExclusive||!c.windowMonths||!c.sourceVerified)return null;
    return {lower:100*c.employed/c.graduates,upper:100*(c.employed+c.unknown)/c.graduates,
      numerator:c.employed,denominator:c.graduates,unknown:c.unknown};
  }
  function factor(id,group,name,raw,score,weight,formula,scope,records=[],missing=''){
    return {id,group,name,raw,score,weight,formula,scope,records,missing};
  }
  function salaryRatio(s,target,actualOnly=true){
    if(!s||!Number.isFinite(target)||target<=0||!Number.isFinite(s.lower)||!Number.isFinite(s.upper)||s.lower<0||s.upper<s.lower)return null;
    if(actualOnly&&s.actual!==true)return null;
    return [100*s.lower/(target*10000),100*s.upper/(target*10000)];
  }
  function assess(p,f,target,degreePlan,mappingPending=false,employerTarget=3){
    if(!Number.isInteger(employerTarget)||employerTarget<1||employerTarget>50)throw Error('Invalid employer target');
    const bachelorRoute=!!f?.quality?.bachelorAlternative&&degreePlan!=='graduate';
    const q=bachelorRoute?f.quality.bachelorAlternative:f?.quality;
    const records=bachelorRoute?(f?.supplementaryRecords||[]):[...(f?.records||[]),...(f?.supplementaryRecords||[])];
    // Never pool bachelor company jobs with postgraduate institute outcomes.
    const matched=records.filter(r=>known(r)&&WINDOW.includes(r.year)&&
      (bachelorRoute?/本科/.test(r.degree):f?.ids.includes('B10')?/硕士|博士/.test(r.degree):/本科/.test(r.degree)));
    const routeRecords=[...new Map(matched.map(r=>[[r.cacheKey,r.year,r.employerGroup||r.employer,r.stage,r.quote,r.degree].join('|'),r])).values()];
    const plans=routeRecords.filter(r=>r.stage==='招聘计划');
    const years=[...new Set(plans.map(r=>r.year))].sort();
    const groups=[...new Set(plans.map(r=>r.employerGroup||r.employer))];
    const usable=!mappingPending&&plans.length>0;
    const scope=bachelorRoute?'全国已检索样本：测控本科企业仪表路径':f?.ids.includes('B10')?'全国已检索样本：计量院所硕士路径':'全国已检索样本：本科职业入口';
    const planCount=plans.filter(r=>Number.isInteger(r.count)&&r.count>=0).reduce((s,r)=>s+r.count,0);
    const ruleText=(q?.records||[]).filter(r=>r.verified&&r.p0).map(r=>[r.quote,...r.supportingQuotes].join(' ')).join(' ');
    const safeguards=[/事业单位公开招聘/.test(ruleText),/试用期满考核合格/.test(ruleText)].filter(Boolean).length;
    const factors=[
      factor('repeat','入口信号','专业相关招聘出现年份',`${years.length}/5年；${years.join('、')||'未核'}`,usable?[years.length/5*100,100]:null,25,'已见年份数÷五年×100为下界；未核年份保留未知，最高100',scope,plans,'未检索到≠当年无岗位；不是全国招聘连续性估计'),
      factor('diversity','入口信号','独立雇主体系',`${groups.length}个已核体系；家庭目标${employerTarget}个`,usable?[Math.min(groups.length/employerTarget,1)*100,100]:null,20,`min(已核独立体系数÷家庭目标${employerTarget},1)×100为下界；未枚举雇主保留未知`,scope,plans,'转载、同集团及同系统不重复增加；家庭目标不是充分分散风险的经验阈值'),
      factor('exclusive','入口信号','目标专业进入优势','可报≠优先或专属',null,20,'100×目标专业专属名额÷全部适配名额；多专业共享不分摊',scope,plans,'专属/优先规则与逐岗分母未核'),
      factor('competition','入口信号','实际竞争入口','报名/合格/录用同批分母未核',null,20,'100×最终录用人数÷同批合格申请人数；不是本校就业率',scope,[],'须同批、同地区、同学历、同岗位'),
      factor('supply','入口信号','岗位与合格供给','同市场岗位及合格毕业供给未核',null,15,'min(去重且可进入岗位数÷同市场合格供给,1)×100',scope,[],'外专业、硕士、往届与迁移竞争须纳入；不得用全国专业招生数替代'),
      factor('employment','真实结果','本校同届真实工作比例','毕业/实际就业/未知人数待核',null,100,'区间：[已核工作人数/D,(已核工作+未知)/D]；升学另列',`${p.school}—${p.major}；毕业后6个月`,[],'无同校同专业、同届互斥去向分母'),
      factor('matched','背景量','本校对口就业人数','待核，不由语义相似度推算',null,0,'对口工作人数÷实际工作人数；职业任务和培养映射双核',`${p.school}—${p.major}`,[],'须同时报告人数、职业分类和工作分母'),
      factor('plans','背景量','明确数字的岗位计划',plans.length?plans.every(r=>r.count==null)?`人数均未给定；${plans.length}条计划`:`${planCount}名已见数值；另${plans.filter(r=>r.count==null).length}条人数未给定`:'未核',null,0,'仅逐岗招聘计划可去重合计；共享人数不得归给目标专业',scope,plans,'这不是录用、报到或本校人数；人数不限不转数字'),
      factor('stages','背景量','签约 / 拟录用 / 报到',routeRecords.filter(r=>r.stage!=='招聘计划').map(r=>`${r.year} ${r.stage}：${r.count??'人数未给'}（${r.countScope||'范围待核'}）`).join('；')||'目标路径结果待核',null,0,'各阶段独立计数；混合培训人数不计入到岗',scope,routeRecords.filter(r=>r.stage!=='招聘计划'),'不得用集团全专业结果增强目标专业结论'),
      factor('payMedian','实际薪酬','实际年现金薪酬中位数','待核',null,50,'min(100,实际税前年现金薪酬中位数÷家庭目标×100)',scope,[],'全职、同届、同城市/岗位；完整12个月；样本及抽样框待核'),
      factor('payLower','实际薪酬','实际年现金薪酬P25','待核',null,50,'min(100,实际现金薪酬P25÷家庭目标×100)；关注下四分位',scope,[],'与中位数来自同一可比样本；两者不是独立证据'),
      factor('adPay','背景量','招聘报价 / 期望收入',usable&&(q?.records||[]).some(r=>r.verified&&r.p0&&r.stage==='招聘薪酬承诺')&&salaryRatio(q?.salary,target,false)?salaryRatio(q.salary,target,false).map(x=>x.toFixed(0)+'%').join('—')+'（历史广告）':target===0?'目标为0，不计算比例':'金额未知或路径未映射',null,0,'广告金额÷家庭收入目标；不计入实际薪酬加权分',q?.salary?`${q.salary.year} ${q.salary.employer}；综合收入、含浮动项` : scope,q?.records||[],'税前税后、试用期、补贴及实际兑现须另核；广告“起”不是工资上限'),
      factor('hourly','背景量','工时 / 实际小时收入','待核',null,0,'实际现金薪酬÷实际有薪及无薪工作小时；不假定每周40小时',scope,[],'高年薪可能来自长工时；当地生活成本和一次性补贴单列'),
      factor('business','业务持续性','持续业务 / 已落实预算占比','收入构成或已落实预算待核',null,50,'企业：持续业务收入÷总收入；公共部门：已落实常规预算÷全年支出；两类分层展示，不互排',scope,[],'政策愿景、订单总额不等于可收现金；项目制与经常性业务分离'),
      factor('funding','业务持续性','可用资金支撑月数','资金、固定现金支出及债务到期待核',null,50,'min(已核可动用净资金÷月度必要现金支出÷12,1)×100；12个月是偏好锚点',scope,[],'企业用审计报表及期限；公共部门用落实预算；受限现金不能全算可用'),
      factor('continuous','工作持续性','到岗后12个月仍有工作比例','到岗人数、失访、仍工作人数待核',null,40,'到岗后12个月仍工作人数÷已到岗同批人数；未知给上下界',scope,[],'允许换雇主；单时点有工作≠全年连续就业；首次到岗时间须匹配'),
      factor('timelyPay','工作持续性','工资按时足额月占比','待核',null,30,'按时足额支付的人员月÷应支付人员月×100',scope,[],'覆盖至少12个月，未回应不得当按时支付'),
      factor('contract','工作持续性','合同 / 已承诺资金期限','具体合同与预算期限待核',null,30,'min(有证合同/资金剩余月份÷36,1)×100；仅期限偏好，不是免裁员或保证支付',scope,q?.records||[],'国企、外企、民企标签不能代替直签、派遣、合同和资金来源'),
      factor('retention','背景量','6 / 12个月原雇主留任','两时点各自分母待核',null,0,'同批仍在原雇主人数÷已到岗人数；死亡、升学、主动/被动离职另列',scope,[],'最低服务期≠留任；转到更好职位≠失业'),
      factor('layoff','背景量','12个月被动离职比例','同岗位族在职人数与退出原因待核',null,0,'被动离职人数÷期初同岗位族在职人数；与主动跳槽分开',scope,[],'全集团裁员不直接归给某岗位；没有负面报道不是零裁员'),
      factor('qualification','背景量','资格 / 培养路径通过人数','证书、语言、分流、升学分母待核',null,0,'逐关报告通过人数÷进入该关人数；失访单列，不假设各关独立',`${p.school}—${p.major}`,[],'可报专业不等于可获证，公开成功个案不代表完成率'),
      factor('safeguards','背景量','用工规则已明确项',usable&&safeguards?`${safeguards}/5项：招聘身份 / 试用规则已见`:'0/5项已核；不代表没有保障',null,0,'招聘身份、合同主体、合同期限、试用退出、解约救济各一项；当前仅识别已审阅的身份/试用项',scope,q?.records||[],'公告身份不证明个人编制；五险一金是福利承诺，不是合同期限'),
      factor('cost','背景量','学费与路径代价',typeof p.tuition==='number'?`${p.tuition}元/年；完整路径成本待核`:'学费及完整成本待核',null,0,'学费+生活+考证/语言/实习+读研/海外+时间成本；不可重复相加',`${p.school}—${p.major}`,[],'服务期、迁移、倒班、体检是约束，不用高薪补偿硬禁忌')
    ];
    return {version:VERSION,scope,usable,factors,years,groups,planCount,employerTarget,
      groupsByName:Object.fromEntries(['入口信号','真实结果','实际薪酬','业务持续性','工作持续性'].map(name=>[name,factors.filter(f=>f.group===name)])),
      mappingPending,route:q?.role||scope};
  }
  function scenarios(model){
    return [{name:'均衡',weights:{}},{name:'重跨年',weights:{repeat:45,diversity:10,exclusive:15,competition:15,supply:15}},
      {name:'重退路',weights:{repeat:10,diversity:40,exclusive:15,competition:20,supply:15}}]
      .map(s=>({...s,result:weightedBounds(model.groupsByName['入口信号'],s.weights)}));
  }
  function sourceStress(p,f,target,degreePlan,mappingPending=false,employerTarget=3){
    if(!f)return [];
    const all=[...f.records,...(f.supplementaryRecords||[])];
    const keys=[...new Set(all.filter(known).map(r=>r.cacheKey))];
    return keys.map(key=>{
      const keep=r=>r.cacheKey!==key;
      const stripped={...f,records:f.records.filter(keep),supplementaryRecords:(f.supplementaryRecords||[]).filter(keep)};
      if(f.quality)stripped.quality={...f.quality,records:(f.quality.records||[]).filter(keep),
        ...(f.quality.bachelorAlternative?{bachelorAlternative:{...f.quality.bachelorAlternative,records:f.quality.bachelorAlternative.records.filter(keep)}}:{})};
      const model=assess(p,stripped,target,degreePlan,mappingPending,employerTarget);
      return {key,title:all.find(r=>r.cacheKey===key).title,model,result:weightedBounds(model.groupsByName['入口信号'])};
    });
  }
  root.GAOBAO_ASSESSMENT={VERSION,WINDOW,weightedBounds,robustOrder,cohortBounds,salaryRatio,assess,scenarios,sourceStress};
})(typeof window==='undefined'?globalThis:window);
