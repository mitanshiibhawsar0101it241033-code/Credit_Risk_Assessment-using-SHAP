const API_URL = "/predict"; // same origin on Render; use a full URL if the UI is hosted separately
const ARC = 282.74;         // length of the gauge arc (π × 90)

const $ = (id) => document.getElementById(id);
const form = $("form"), btn = $("submit"), result = $("result");

// Loan-to-income ratio is derived, not typed
function updatePct() {
  const income = parseFloat($("income").value), amt = parseFloat($("amount").value);
  $("pct").textContent = income > 0 && amt >= 0 ? (amt / income).toFixed(2) : "–";
}
["income", "amount"].forEach((id) => $(id).addEventListener("input", updatePct));
updatePct();

function placeTick(t) {
  const a = Math.PI * (1 - t), cx = 110, cy = 110;
  const pt = (r) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x1, y1] = pt(78), [x2, y2] = pt(102);
  const tick = $("tick");
  tick.setAttribute("x1", x1); tick.setAttribute("y1", y1);
  tick.setAttribute("x2", x2); tick.setAttribute("y2", y2);
}

function countUp(to) {
  const el = $("num"), start = performance.now(), dur = 1300;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { el.textContent = to.toFixed(1); return; }
  (function frame(now) {
    const p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * e).toFixed(1);
    if (p < 1) requestAnimationFrame(frame);
  })(start);
}

function showResult(d) {
  const p = d.default_probability, high = d.default_prediction === 1;
  result.dataset.state = high ? "high" : "low";
  result.classList.remove("pop"); void result.offsetWidth; result.classList.add("pop");
  placeTick(Math.min(d.threshold, 1));
  $("fill").style.strokeDashoffset = ARC * (1 - Math.min(p, 1));
  countUp(p * 100);
  $("verdict").textContent = high ? "High risk" : "Low risk";
  $("detail").textContent = high
    ? "The estimated chance of default is above the cut-off. Review this application carefully."
    : "The estimated chance of default is below the cut-off. This application looks safe to approve.";
  const c = $("cutoff"); c.hidden = false;
  c.textContent = `Cut-off is ${(d.threshold * 100).toFixed(1)}% (the marker on the gauge).`;
}

function showError(msg) {
  result.dataset.state = "error";
  $("fill").style.strokeDashoffset = ARC;
  $("num").textContent = "–";
  $("verdict").textContent = "Couldn't get a result";
  $("detail").textContent = msg;
  $("cutoff").hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // basic validation
  let ok = true;
  form.querySelectorAll("input[required]").forEach((i) => {
    const bad = i.value === "" || i.validity.rangeUnderflow || i.validity.rangeOverflow;
    i.classList.toggle("bad", bad); if (bad) ok = false;
  });
  if (!ok) return showError("Some fields are empty or out of range. Fix the highlighted ones and try again.");

  const f = new FormData(form);
  const payload = {
    person_age: parseInt(f.get("person_age")),
    person_income: parseFloat(f.get("person_income")),
    person_home_ownership: f.get("person_home_ownership"),
    person_emp_length: String(f.get("person_emp_length")),
    loan_intent: f.get("loan_intent"),
    loan_grade: f.get("loan_grade"),
    loan_amnt: parseFloat(f.get("loan_amnt")),
    loan_int_rate: parseFloat(f.get("loan_int_rate")),
    loan_percent_income: parseFloat((f.get("loan_amnt") / f.get("person_income")).toFixed(2)),
    cb_person_default_on_file: f.get("cb_person_default_on_file"),
    cb_person_cred_hist_length: parseInt(f.get("cb_person_cred_hist_length")),
  };

  btn.disabled = true; btn.classList.add("loading");
  btn.querySelector(".btn-text").textContent = "Checking";
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`The server replied with status ${res.status}.`);
    showResult(await res.json());
  } catch (err) {
    showError(err.message.includes("status") ? err.message : "The server isn't reachable. On Render's free plan it may be waking up, so try again in a few seconds.");
  } finally {
    btn.disabled = false; btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Check risk";
  }
});
