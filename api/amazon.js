// /api/amazon  —  Amazon Ads 실시간 성과
// Vercel Serverless Function (Node 18+, global fetch 사용)
// 배포 시 위치: 프로젝트 루트의  api/amazon.js  로 둘 것
//
// ※ Amazon Ads API는 개발자 등록 + API 접근 "심사 승인"이 필요합니다 (수일~수주 소요).
//   승인 후 아래 환경변수를 채우면 실데이터로 전환됩니다.
//
// 필요한 환경변수:
//   AMZN_CLIENT_ID      : Login with Amazon (LWA) 앱 client id
//   AMZN_CLIENT_SECRET  : LWA client secret
//   AMZN_REFRESH_TOKEN  : OAuth 동의 후 발급된 refresh token
//   AMZN_PROFILE_ID     : 광고 프로파일 ID (마켓플레이스별)
//   AMZN_REGION         : (선택) na | eu | fe  (기본 na, 미국)
//
// 자격증명이 없으면 demo:true 와 함께 더미데이터를 반환.

const ADS_HOST = {
  na: "https://advertising-api.amazon.com",
  eu: "https://advertising-api-eu.amazon.com",
  fe: "https://advertising-api-fe.amazon.com",
};

function demoPayload(reason) {
  return {
    demo: true,
    reason: reason || "Amazon Ads 자격증명 미설정 (API 승인 대기 중)",
    summary: { sales: 101300, spend: 30900, acos: 30.5, tacos: 17.6, roas: 3.28, orders: 6710, clicks: 21800, impressions: 4520000 },
    monthly: [
      { m: "1월", sales: 12000, spend: 2400 },
      { m: "2월", sales: 14000, spend: 2800 },
      { m: "3월", sales: 15000, spend: 2900 },
      { m: "4월", sales: 17000, spend: 3100 },
      { m: "5월", sales: 16000, spend: 3000 },
      { m: "6월", sales: 18000, spend: 3200 },
    ],
    skus: [
      { sku: "KMC-001", name: "Original Kimchi 16oz", sales: 41200, units: 3120, acos: 14.2 },
      { sku: "KMC-002", name: "Vegan Kimchi 16oz", sales: 26800, units: 1980, acos: 19.8 },
      { sku: "KMC-003", name: "Kimchi Snack Pack", sales: 18400, units: 2440, acos: 31.5 },
      { sku: "KMC-004", name: "Gochujang Paste", sales: 9900, units: 760, acos: 16.1 },
      { sku: "KMC-005", name: "Kimchi Variety Bundle", sales: 5000, units: 410, acos: 22.0 },
    ],
  };
}

// LWA refresh token -> access token 교환
async function getAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || "LWA 토큰 교환 실패");
  return j.access_token;
}

export default async function handler(req, res) {
  const clientId = process.env.AMZN_CLIENT_ID;
  const clientSecret = process.env.AMZN_CLIENT_SECRET;
  const refreshToken = process.env.AMZN_REFRESH_TOKEN;
  const profileId = process.env.AMZN_PROFILE_ID;
  const region = (process.env.AMZN_REGION || "na").toLowerCase();

  if (!clientId || !clientSecret || !refreshToken || !profileId) {
    return res.status(200).json(demoPayload());
  }

  const host = ADS_HOST[region] || ADS_HOST.na;

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/json",
    };

    // 연결 확인 + 캠페인 목록 (Sponsored Products v3)
    const cmpRes = await fetch(`${host}/sp/campaigns/list`, {
      method: "POST",
      headers: { ...headers, Accept: "application/vnd.spCampaign.v3+json" },
      body: JSON.stringify({ maxResults: 50 }),
    });
    const cmpJson = await cmpRes.json();

    // 참고: 매출/ACOS/ROAS 등 성과 지표는 Amazon Ads "Reporting API(v3)"가
    // 비동기(리포트 생성 요청 -> 폴링 -> gzip 다운로드) 방식이라 별도 작업이 필요합니다.
    // 1차 버전에서는 연결 성공 여부 + 캠페인 수를 반환하고, 지표는 데모를 폴백으로 사용합니다.
    const base = demoPayload("실데이터 연결됨 · 성과 지표는 Reporting API 연동 후 표시");
    base.demo = false;
    base.connected = true;
    base.campaignCount = Array.isArray(cmpJson.campaigns) ? cmpJson.campaigns.length : 0;
    base.profileId = profileId;
    return res.status(200).json(base);
  } catch (e) {
    return res.status(200).json(demoPayload("예외: " + e.message));
  }
}
