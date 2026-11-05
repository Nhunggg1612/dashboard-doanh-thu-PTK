// Netlify Function: nhận lệnh từ nút "Run" trên web -> gọi GitHub API chạy workflow deploy.yml
// GET  /.netlify/functions/run-build  -> trả trạng thái lượt chạy gần nhất
// POST /.netlify/functions/run-build  -> kích hoạt workflow (body: { key: "..." } nếu có đặt RUN_KEY)
//
// Biến môi trường trên Netlify (Project configuration > Environment variables):
//   GH_PAT      : GitHub fine-grained token, quyền Actions: Read and write cho repo này
//   GH_REPO     : "ten-tai-khoan/ten-repo"
//   GH_WORKFLOW : "deploy.yml"
//   RUN_KEY     : (tuỳ chọn) mã bí mật để được bấm Run

function json(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function (event) {
  var repo = process.env.GH_REPO;
  var wf = process.env.GH_WORKFLOW || "deploy.yml";
  var token = process.env.GH_PAT;

  if (!repo || !token) {
    return json(500, { error: "Thiếu biến môi trường GH_REPO / GH_PAT trên Netlify" });
  }

  var headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "netlify-run-button",
  };
  var api = "https://api.github.com/repos/" + repo + "/actions/workflows/" + wf;

  async function latestRun() {
    var r = await fetch(api + "/runs?per_page=1", { headers: headers });
    if (!r.ok) return null;
    var d = await r.json();
    return d.workflow_runs && d.workflow_runs[0] ? d.workflow_runs[0] : null;
  }

  try {
    // ----- GET: trạng thái -----
    if (event.httpMethod === "GET") {
      var run = await latestRun();
      return json(200, run
        ? { status: run.status, conclusion: run.conclusion, started: run.run_started_at, event: run.event }
        : {});
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // ----- POST: kiểm tra mã -----
    if (process.env.RUN_KEY) {
      var body = {};
      try { body = JSON.parse(event.body || "{}"); } catch (e) {}
      if (body.key !== process.env.RUN_KEY) {
        return json(401, { error: "Sai mã chạy" });
      }
    }

    // Đang có lượt chạy thì không gửi thêm
    var last = await latestRun();
    if (last && last.status !== "completed") {
      return json(200, { ok: true, running: true });
    }

    var r = await fetch(api + "/dispatches", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ ref: "main" }),
    });

    if (r.status !== 204) {
      var txt = await r.text();
      return json(500, { error: "GitHub trả lỗi " + r.status + ": " + txt });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e && e.message ? e.message : e) });
  }
};
