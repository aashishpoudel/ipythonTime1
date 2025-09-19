export default {
  async fetch(request, env) {
    const { method, url, headers } = request;

    // CORS
    const cors = (() => {
      // allow either a single origin from env or a small allowlist
      const origin = request.headers.get("Origin") || "";
      const allowlist = new Set([
        env.ALLOWED_ORIGIN || "https://www.ipythontime.com",
      ]);
      const allowOrigin = allowlist.has(origin) ? origin : [...allowlist][0];
      return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-admin-key",
      };
    })();

    if (method === "OPTIONS") return new Response(null, { headers: cors });

    const pathname = new URL(url).pathname;

    // ---- debug endpoint ----
    if (method === "GET" && pathname === "/api/debug") {
      const keys = Object.keys(env || {});
      const hasDB = !!env.DB;
      let probe = null;
      if (hasDB) {
        try {
          probe = await env.DB.prepare("select 42 as x").first();
        } catch (e) {
          probe = String(e);
        }
      }
      return new Response(JSON.stringify({ hasDB, keys, probe }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // ---- public submit endpoint ----
    if (method === "POST" && pathname === "/api/submit") {
      let body;
      try { body = await request.json(); }
      catch { return json({ ok:false, error:"Invalid JSON" }, 400, cors); }

      if (!body?.email) return json({ ok:false, error:"Missing email" }, 400, cors);

      const stmt = `
        INSERT INTO signups
          (who_is_learning, student_name, student_dob, parent_name, email, phone,
           phone_country_iso, phone_dial_code, country_iso, country_label, message)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
      `;
      const vals = [
        body.who_is_learning ?? null,
        body.student_name ?? null,
        body.student_dob ?? null,
        body.parent_name ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.phone_country_iso ?? null,
        body.phone_dial_code ?? null,
        body.country_iso ?? null,
        body.country_label ?? null,
        body.message ?? null,
      ];

      try {
        // 1) Save signup in D1
		await env.DB.prepare(stmt).bind(...vals).run();

		// 2) Send confirmation email via Resend — with DEBUG logs
		let email_sent = false;
		let email_error = null;

		const safeEmail = (body.email || "").toString();
		const safeName  = (body.student_name || "").toString();

		console.log("[submit] inserting row OK; attempting email", {
		  to: safeEmail,
		  name: safeName.slice(0, 50) || null
		});

		try {
		  const payload = {
			from: "iPythonTime <noreply@ipythontime.com>", // make sure this SENDER is verified in your provider
			to: safeEmail,
			subject: "Thanks for signing up with iPythonTime!",
			html: `<p>Hi ${escapeHtml(safeName) || "there"},</p>
				   <p>Thanks for signing up at iPythonTime! We’ll reach out soon with timeslots and next steps.</p>
				   <p>– The iPythonTime Team</p>`
		  };

		  console.log("[submit] email payload preview", {
			from: payload.from,
			to: payload.to,
			subject: payload.subject
		  });

		  const emailRes = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
			  "Authorization": `Bearer ${env.RESEND_API_KEY}`,
			  "Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		  });

		  let emailText = "";
		  try { emailText = await emailRes.text(); } catch {}

		  // Log raw response (status + body) for diagnosis
		  console.log("[submit] email API response", {
			ok: emailRes.ok,
			status: emailRes.status,
			body: emailText?.slice(0, 500) || null
		  });

		  // Best-effort parse back to JSON for your frontend
		  let emailJson = null;
		  try { emailJson = JSON.parse(emailText); } catch {}

		  if (emailRes.ok) {
			email_sent = true;
		  } else {
			email_error = { status: emailRes.status, body: emailJson || emailText || null };
			console.error("[submit] email send failed", email_error);
		  }

		} catch (err) {
		  email_error = String(err);
		  console.error("[submit] email send exception", email_error);
		}

		// 3) Return success (include email status for visibility)
		return json({ ok: true, email_sent, email_error }, 200, cors);

      } catch (e) {
        return json({ ok:false, error:String(e) }, 500, cors);
      }
    }

    // ---- admin read example (protected) ----
    if (method === "GET" && pathname === "/api/admin/latest") {
      if (headers.get("x-admin-key") !== env.ADMIN_KEY)
        return new Response("Unauthorized", { status: 401, headers: cors });

      const { results } = await env.DB.prepare(`
        SELECT id, created_at, student_name, email, phone_dial_code, phone, country_iso
        FROM signups ORDER BY id DESC LIMIT 50
      `).all();
      return json({ ok:true, results }, 200, cors);
    }

    return new Response("Not found", { status: 404, headers: cors });
  }
};

function json(obj, status=200, headers={}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type":"application/json", ...headers }
  });
}

// very small HTML escape for safety in the email body
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
