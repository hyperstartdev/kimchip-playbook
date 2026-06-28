// /api/meta  —  Meta(Facebook/Instagram) Ads 실시간 성과
// Vercel Serverless Function (Node 18+, global fetch 사용)
// 배포 시 위치: 프로젝트 루트의  api/meta.js  로 둘 것
//
// 필요한 환경변수 (Vercel > Project > Settings > Environment Variables):
//   META_ACCESS_TOKEN   : 시스템 사용자 장기 토큰 (권한: ads_read)
//   META_AD_ACCOUNT_ID  : 광고계정 ID (숫자만, act_ 접두사 제외)
//   META_API_VERSION    : (선택) 기본값 v21.0
//
// 자격증명이 없으면 demo:true 와 함께 더미데이터를 반환 → 프론트가 그대로 표시.

const API_VER = process.env.META_API_VERSION || "v21.0";

function demoPayload(reason) {
  return {
    demo: true,
    reason: reason || "META_ACCESS_TOKEN / META_AD_ACCOUNT_ID 미설정",
    summary: { spend: 17300, revenue: 54200, roas: 3.13, impressions: 2100000, clicks: 88000, ctr: 4.19, purchases: 3100, cpm: 8.4 },
    daily: Array.from({ length: 14 }, (_, i) => ({
      date: `6/${15 + i}`,
      spend: Math.round(400 + Math.random() * 500),
      roas: +(2 + Math.random() * 3).toFixed(2),
    })),
    campaigns: [
      { name: "US_Conversion_Kimchi", objective: "전환", spend: 7200, roas: 3.8, ctr: 1.9, status: "활성" },
      { name: "US_Spark_Creator", objective: "트래픽", spend: 4900, roas: 2.9, ctr: 2.4, status: "활성" },
      { name: "US_Retarget_Cart", objective: "전환", spend: 3100, roas: 4.6, ctr: 1.2, status: "활성" },
      { name: "US_Awareness_Vegan", objective: "인지", spend: 2100, roas: 1.4, ctr: 0.8, status: "검토" },
    ],
  };
}

function pickAction(arr, type) {
  if (!Array.isArray(arr)) return 0;
  const f = arr.find((a) => a.action_type === type);
  return f ? Number(f.value) : 0;
}

export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  const acct = process.env.META_AD_ACCOUNT_ID;
  if (!token || !acct) {
    return res.status(200).json(demoPayload());
  }

  const base = `https://graph.facebook.com/${API_VER}/act_${acct}`;
  const fields = [
    "spend", "impressions", "clicks", "ctr", "cpm",
    "actions", "action_values", "purchase_roas",
  ].join(",");

  try {
    // 1) 계정 전체 요약 (최근 30일)
    const sumUrl = `${base}/insights?fields=${fields}&date_preset=last_30d&access_token=${token}`;
    const sumRes = await fetch(sumUrl);
    const sumJson = await sumRes.json();
    if (sumJson.error) return res.status(200).json(demoPayload("Meta API: " + sumJson.error.message));

    const row = (sumJson.data && sumJson.data[0]) || {};
    const purchases = pickAction(row.actions, "purchase") || pickAction(row.actions, "omni_purchase");
    const revenue = pickAction(row.action_values, "purchase") || pickAction(row.action_values, "omni_purchase");
    const spend = Number(row.spend || 0);
    const roas = spend ? +(revenue / spend).toFixed(2) : 0;

    const summary = {
      spend: Math.round(spend),
      revenue: Math.round(revenue),
      roas,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      ctr: +Number(row.ctr || 0).toFixed(2),
      cpm: +Number(row.cpm || 0).toFixed(2),
      purchases,
    };

    // 2) 일별 추이 (최근 14일)
    const dayUrl = `${base}/insights?fields=spend,purchase_roas&date_preset=last_14d&time_increment=1&access_token=${token}`;
    const dayRes = await fetch(dayUrl);
    const dayJson = await dayRes.json();
    const daily = (dayJson.data || []).map((d) => ({
      date: (d.date_start || "").slice(5).replace("-", "/"),
      spend: Math.round(Number(d.spend || 0)),
      roas: d.purchase_roas ? +Number(d.purchase_roas[0].value).toFixed(2) : 0,
    }));

    // 3) 캠페인별
    const cmpUrl = `${base}/insights?level=campaign&fields=campaign_name,objective,spend,ctr,purchase_roas&date_preset=last_30d&limit=20&access_token=${token}`;
    const cmpRes = await fetch(cmpUrl);
    const cmpJson = await cmpRes.json();
    const campaigns = (cmpJson.data || []).map((c) => ({
      name: c.campaign_name,
      objective: c.objective || "-",
      spend: Math.round(Number(c.spend || 0)),
      roas: c.purchase_roas ? +Number(c.purchase_roas[0].value).toFixed(2) : 0,
      ctr: +Number(c.ctr || 0).toFixed(2),
      status: "활성",
    }));

    return res.status(200).json({ demo: false, summary, daily, campaigns });
  } catch (e) {
    return res.status(200).json(demoPayload("예외: " + e.message));
  }
}
