(() => {
  "use strict";

  /* ─────────────── 설정 ─────────────── */
  const CONFIG = {
    // 신청 내용을 받을 주소 (Google Apps Script 웹 앱 URL 등). README.md 참고.
    // 비워두면 데모 모드: 이 브라우저(localStorage)에만 저장되고 운영자에게는 전달되지 않습니다.
    SUBMIT_URL: "",
    PRICE: 30000,      // 1인 입장료(원)
    MAX_GUESTS: 4,     // 한 번에 신청 가능한 최대 인원
    CLOSED: false,     // true 로 바꾸면 신청 버튼이 "마감되었습니다"로 바뀜
    EVENT: {
      title: "Truffle Scoop @ 기린하우스",
      location: "기린하우스 (운천동 1575)",
      description: "Exhibition & Community 17:00-21:00 / DJ Set 19:00-21:00 (@boundarybetween)",
      // 2026-10-10 17:00–21:00 KST = 08:00–12:00 UTC
      startUtc: "20261010T080000Z",
      endUtc: "20261010T120000Z",
    },
  };

  /* ─────────────── 요소 ─────────────── */
  const $ = (id) => document.getElementById(id);
  const apply = $("apply"), truffles = $("truffles"), progress = $("progress-label");
  const cta = $("cta"), closed = $("closed"), form = $("form"), done = $("done");
  const btnOpen = $("open-form"), btnPrev = $("btn-prev"), btnNext = $("btn-next");
  const steps = [...form.querySelectorAll(".step")];
  const formError = $("form-error");
  const guestsOut = $("guests-out"), guestsInput = $("f-guests");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let step = 0;
  let submitting = false;

  const won = (n) => n.toLocaleString("ko-KR") + "원";
  const scrollTo = (el) => el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });

  /* ─────────────── 시작 / 마감 ─────────────── */
  if (CONFIG.CLOSED) {
    cta.hidden = true;
    closed.hidden = false;
  }

  btnOpen.addEventListener("click", () => {
    cta.hidden = true;
    form.hidden = false;
    apply.classList.add("is-open");
    goTo(1);
  });

  /* ─────────────── 단계 이동 ─────────────── */
  function goTo(n) {
    step = n;
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    truffles.dataset.step = String(n);
    progress.textContent = `3단계 중 ${n}단계`;
    btnPrev.hidden = n === 1;
    btnNext.textContent = n === 3 ? "신청 완료" : "다음";
    formError.textContent = "";
    if (n === 3) renderSummary();

    const target = steps[n - 1].querySelector("input:not([type=hidden]), textarea, button");
    if (target) target.focus({ preventScroll: true });
    scrollTo(steps[n - 1]);
  }

  btnPrev.addEventListener("click", () => { if (step > 1) goTo(step - 1); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting || !validate(step)) return;
    if (step < 3) return goTo(step + 1);
    await submit();
  });

  /* ─────────────── 입력 ─────────────── */
  const phone = $("f-phone");
  phone.addEventListener("input", () => {
    const d = phone.value.replace(/\D/g, "").slice(0, 11);
    phone.value = d.length <= 3 ? d : d.length <= 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  });

  function setGuests(n) {
    n = Math.max(1, Math.min(CONFIG.MAX_GUESTS, n));
    guestsInput.value = n;
    guestsOut.textContent = n;
    $("guests-minus").disabled = n <= 1;
    $("guests-plus").disabled = n >= CONFIG.MAX_GUESTS;
  }
  $("guests-minus").addEventListener("click", () => setGuests(+guestsInput.value - 1));
  $("guests-plus").addEventListener("click", () => setGuests(+guestsInput.value + 1));
  $("guests-hint").textContent = `한 번에 최대 ${CONFIG.MAX_GUESTS}명까지 신청할 수 있어요.`;
  setGuests(1);

  /* ─────────────── 검증 ─────────────── */
  function fieldError(input, msg) {
    const field = input.closest(".field");
    const box = field.querySelector(".field__error");
    field.classList.toggle("is-invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    box.textContent = msg || "";
    return !msg;
  }

  function validate(n) {
    if (n === 1) {
      const name = $("f-name"), tel = $("f-phone"), mail = $("f-email");
      const digits = tel.value.replace(/\D/g, "");
      const results = [
        fieldError(name, name.value.trim() ? "" : "이름을 입력해주세요."),
        fieldError(tel, /^01[016789]\d{7,8}$/.test(digits) ? "" : "휴대폰 번호를 정확히 입력해주세요."),
        fieldError(mail, !mail.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim()) ? "" : "이메일 형식을 확인해주세요."),
      ];
      if (results.includes(false)) {
        form.querySelector('.step[data-step="1"] [aria-invalid="true"]')?.focus();
        return false;
      }
    }
    if (n === 3) {
      const ok = $("f-consent").checked;
      $("consent-error").textContent = ok ? "" : "개인정보 수집·이용에 동의해주세요.";
      if (!ok) return false;
    }
    return true;
  }
  $("f-consent").addEventListener("change", () => { $("consent-error").textContent = ""; });

  /* ─────────────── 확인 화면 ─────────────── */
  function values() {
    const fd = new FormData(form);
    return {
      name: fd.get("name").trim(),
      phone: fd.get("phone").trim(),
      email: fd.get("email").trim(),
      guests: Number(fd.get("guests")),
      source: fd.get("source") || "",
      note: fd.get("note").trim(),
    };
  }

  function renderSummary() {
    const v = values();
    const rows = [
      ["이름", v.name],
      ["연락처", v.phone],
      v.email && ["이메일", v.email],
      ["참가 인원", `${v.guests}명`],
      v.source && ["알게 된 경로", v.source],
      v.note && ["요청사항", v.note],
    ].filter(Boolean);
    const total = CONFIG.PRICE * v.guests;
    rows.push(["입장료", `${CONFIG.PRICE.toLocaleString("ko-KR")} × ${v.guests}명 = ${won(total)}`, "total"]);

    const dl = $("summary");
    dl.replaceChildren(...rows.map(([k, val, cls]) => {
      const row = document.createElement("div");
      if (cls) row.className = cls;
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = val;
      row.append(dt, dd);
      return row;
    }));
  }

  /* ─────────────── 제출 ─────────────── */
  async function submit() {
    const v = values();
    // 봇 방지: 숨김 입력란이 채워져 있으면 조용히 성공 처리만 한다
    if (new FormData(form).get("website")) return finish();

    const payload = {
      submittedAt: new Date().toISOString(),
      ...v,
      total: CONFIG.PRICE * v.guests,
      consent: true,
    };

    submitting = true;
    btnNext.setAttribute("aria-busy", "true");
    btnNext.textContent = "접수 중…";
    formError.textContent = "";

    try {
      await send(payload);
      finish();
    } catch (err) {
      console.error(err);
      formError.textContent = "신청을 접수하지 못했어요. 잠시 후 다시 시도해주세요.";
      btnNext.textContent = "신청 완료";
    } finally {
      submitting = false;
      btnNext.removeAttribute("aria-busy");
    }
  }

  async function send(payload) {
    if (!CONFIG.SUBMIT_URL) {
      const key = "truffle-scoop:applications";
      try {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        list.push(payload);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (_) { /* 저장소를 못 써도 데모 흐름은 계속 */ }
      console.info("[Truffle Scoop] SUBMIT_URL 이 비어 있어 이 브라우저에만 저장했습니다.", payload);
      return;
    }
    // text/plain + no-cors: Apps Script 웹 앱에서 CORS 사전 요청 없이 받을 수 있다
    await fetch(CONFIG.SUBMIT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  function finish() {
    form.hidden = true;
    done.hidden = false;
    truffles.dataset.step = "4";
    progress.textContent = "신청이 완료되었습니다.";
    done.focus({ preventScroll: true });
    scrollTo(done);
  }

  /* ─────────────── 캘린더 ─────────────── */
  $("add-cal").addEventListener("click", () => {
    const e = CONFIG.EVENT;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Truffle Scoop//KO", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:truffle-scoop-${e.startUtc}@girinhaus`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
      `DTSTART:${e.startUtc}`, `DTEND:${e.endUtc}`,
      `SUMMARY:${e.title}`, `LOCATION:${e.location}`, `DESCRIPTION:${e.description}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "truffle-scoop.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
})();
