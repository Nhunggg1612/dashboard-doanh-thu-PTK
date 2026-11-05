// Netlify Function: nhận lệnh từ nút "Run" trên web -> gọi GitHub API chạy workflow deploy.yml
// GET  /.netlify/functions/run-build  -> trả trạng thái lượt chạy gần nhất
// POST /.netlify/functions/run-build  -> kích hoạt workflow (body: { key: "..." } nếu có đặt RUN_KEY)
//
// Biến môi trường cần khai báo trên Netlify (Site configuration > Environment variables):
//   GH_PAT      : GitHub fine-grained token, quyền Actions: Read and write cho repo này
//   GH_REPO     : "ten-tai-khoan/ten-repo"
//   GH_WORKFLOW : "deploy.yml" (tên file workflow)
//   RUN_KEY     : (tuỳ chọn) mã bí mật, người bấm Run phải nhập đúng mới chạy

export default async (req) => {
  const repo = process.env.GH_REPO;
  const wf = process.env.GH_WORKFLOW || "deploy.yml";
  const token = process.env.GH_PAT;

  if (!repo || !token) {
    return Response.json({ error: "Thiếu biến môi trường GH_REPO / GH_PAT trên Netlify" }, { status: 500 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "netlify-run-button",
  };
  const api = `https://api.github.com/repos/${repo}/actions/workflows/${wf}`;

  async function latestRun() {
    const r = await fetch(`${api}/runs?per_page=1`, { headers });
    if (!r.ok) return null;
    const d = await r.json();
    return d.workflow_runs && d.workflow_runs[0] ? d.workflow_runs[0] : null;
  }

  // ----- GET: trạng thái -----
  if (req.method === "GET") {
    const run = await latestRun();
    return Response.json(
      run
        ? { status: run.status, conclusion: run.conclusion, started: run.run_started_at, event: run.event }
        : {},
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ----- POST: kích hoạt -----
  if (process.env.RUN_KEY) {
    const body = await req.json().catch(() => ({}));
    if (body.key !== process.env.RUN_KEY) {
      return Response.json({ error: "Sai mã chạy" }, { status: 401 });
    }
  }

  // Đang có lượt chạy thì không gửi thêm
  const last = await latestRun();
  if (last && last.status !== "completed") {
    return Response.json({ ok: true, running: true });
  }

  const r = await fetch(`${api}/dispatches`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: "main" }),
  });

  if (r.status !== 204) {
    return Response.json({ error: `GitHub trả lỗi ${r.status}: ${await r.text()}` }, { status: 500 });
  }
  return Response.json({ ok: true });
};
