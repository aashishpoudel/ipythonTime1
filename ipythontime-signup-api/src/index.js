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

      // 1) Build the SQL (DEFINE THE VARIABLE)
		const stmt = `
		  INSERT INTO signups
		   (who_is_learning, student_name, student_dob, parent_name, email, phone,
			phone_country_iso, phone_dial_code, country_iso, country_label,
			state,
			city, timezone, preferred_time, message)
		  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,
				  ?11,
				  ?12,?13,?14,?15)
		`;

		// 2) Keep your existing vals (already correct)
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
		  (body.state ?? body.state_label ?? null),
		  body.city ?? null,
		  body.timezone ?? null,
		  (body.preferred_time ?? null),  // <- this gets saved
		  body.message ?? null,
		];

      try {
        // 1) Save signup in D1
		await env.DB.prepare(stmt).bind(...vals).run();

		// 2) EMAILS (two separate sends via Resend)
		let email_user_sent = false,  email_user_error = null;
		let email_admin_sent = false, email_admin_error = null;

		const safeEmail = (body.email || "").toString().trim();
		const safeName  = (body.student_name || "").toString().trim();

		try {
		  // (a) Confirmation to the form filler
		  const userPayload = {
			from: "iPythonTime <noreply@ipythontime.com>",   // must be verified in Resend
			to: safeEmail,
			subject: "Thanks for signing up with iPythonTime!",
			html: `<p>Hi ${escapeHtml(safeName) || "there"},</p>
				   <p>Thanks for signing up at iPythonTime! We’ll reach out soon with timeslots and next steps.</p>
				   <p>– The iPythonTime Team</p>`
		  };
		  console.log("[submit] sending user email", { to: userPayload.to });
		  const userRes  = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
			  "Authorization": `Bearer ${env.RESEND_API_KEY}`,
			  "Content-Type": "application/json",
			},
			body: JSON.stringify(userPayload),
		  });
		  const userText = await userRes.text().catch(() => "");
		  console.log("[submit] user email response", { ok: userRes.ok, status: userRes.status, body: userText?.slice(0, 300) || null });
		  if (userRes.ok) email_user_sent = true; else {
			try { email_user_error = { status: userRes.status, body: JSON.parse(userText) }; }
			catch { email_user_error = { status: userRes.status, body: userText || null }; }
		  }

		  // (b) Separate notification to you (admin)
		  	const who = (body.student_name || "").toString().trim();
			const adminPayload = {
			  from: "iPythonTime <noreply@ipythontime.com>",
			  to: ["aashish.pd@gmail.com", "poulaashish@yahoo.com"],
			  subject: "New signup received",
			  html: `
				<p><strong>New signup</strong></p>
				<table border="1" cellpadding="6" cellspacing="0">
				  <tr><td><b>Who is learning</b></td><td>${escapeHtml(body.who_is_learning || "")}</td></tr>
				  <tr><td><b>Student name</b></td><td>${escapeHtml(body.student_name || "")}</td></tr>
				  <tr><td><b>Student DOB</b></td><td>${escapeHtml(body.student_dob || "")}</td></tr>
				  <tr><td><b>Parent name</b></td><td>${escapeHtml(body.parent_name || "")}</td></tr>
				  <tr><td><b>Email</b></td><td>${escapeHtml(body.email || "")}</td></tr>
				  <tr><td><b>Phone (dial code)</b></td><td>${escapeHtml(body.phone_dial_code || "")}</td></tr>
				  <tr><td><b>Phone (number)</b></td><td>${escapeHtml(body.phone || "")}</td></tr>
				  <tr><td><b>Phone country ISO</b></td><td>${escapeHtml(body.phone_country_iso || "")}</td></tr>
				  <tr><td><b>Country</b></td><td>${escapeHtml(body.country_label || body.country_iso || "")}</td></tr>
				  <tr><td><b>State/Province</b></td><td>${escapeHtml(body.state || body.state_label || "")}</td></tr>
				  <tr><td><b>City</b></td><td>${escapeHtml(body.city || "")}</td></tr>
				  <tr><td><b>Timezone</b></td><td>${escapeHtml(body.timezone || "")}</td></tr>
				  <tr><td><b>Preferred Time</b></td><td>${escapeHtml(body.preferred_time || "")}</td></tr>
				  <tr><td><b>Message</b></td><td>${escapeHtml(body.message || "")}</td></tr>
				  <tr><td><b>Submitted at</b></td><td>${new Date().toISOString()}</td></tr>
				</table>
			  `
			};
		  console.log("[submit] sending admin email", { to: adminPayload.to });
		  const adminRes  = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
			  "Authorization": `Bearer ${env.RESEND_API_KEY}`,
			  "Content-Type": "application/json",
			},
			body: JSON.stringify(adminPayload),
		  });
		  const adminText = await adminRes.text().catch(() => "");
		  console.log("[submit] admin email response", { ok: adminRes.ok, status: adminRes.status, body: adminText?.slice(0, 300) || null });
		  if (adminRes.ok) email_admin_sent = true; else {
			try { email_admin_error = { status: adminRes.status, body: JSON.parse(adminText) }; }
			catch { email_admin_error = { status: adminRes.status, body: adminText || null }; }
		  }

		} catch (err) {
		  // a catch-all in case the fetch itself throws
		  const msg = String(err);
		  if (!email_user_sent && email_user_error == null)  email_user_error  = msg;
		  if (!email_admin_sent && email_admin_error == null) email_admin_error = msg;
		  console.error("[submit] email send exception", msg);
		}

		// 3) Return success (include both email statuses)
		return json({ ok: true, email_user_sent, email_user_error, email_admin_sent, email_admin_error }, 200, cors);

      } catch (e) {
        return json({ ok:false, error:String(e) }, 500, cors);
      }
    }

    // ---- admin read example (protected) ----
    if (method === "GET" && pathname === "/api/admin/latest") {
      if (headers.get("x-admin-key") !== env.ADMIN_KEY)
        return new Response("Unauthorized", { status: 401, headers: cors });

      const { results } = await env.DB.prepare(`
        SELECT id, created_at, student_name, email, phone_dial_code, phone, country_iso, state, city
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
