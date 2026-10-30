// The live thing: type a measurement, the matching size lights up and the order links carry it.
const finder = document.querySelector("[data-finder]");
const rows = [...document.querySelectorAll("[data-sizes] tbody tr")];

if (finder && rows.length) {
  const input = finder.querySelector("input");
  const out = finder.querySelector("output");
  const echo = document.querySelectorAll("[data-size-echo]");
  const mail = document.querySelectorAll("[data-mail]");

  // garment chest: S 24, M 25, L 25 (longer), XL 26. M and L share a chest, so split between them.
  const pick = (v) => rows.find((r) => r.dataset.size === (v < 24.5 ? "S" : v < 25.25 ? "M" : v < 25.75 ? "L" : "XL"));

  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    rows.forEach((r) => r.classList.remove("is-match"));
    if (!(v >= 18 && v <= 34)) {
      out.textContent = input.value ? "Enter a number between 18 and 34." : "";
      echo.forEach((e) => (e.textContent = ""));
      return;
    }
    const row = pick(v);
    row.classList.add("is-match");
    const size = row.dataset.size;
    const off = Math.abs(Number(row.dataset.chest) - v);
    out.textContent = off > 1.5
      ? `Closest is ${size}, but it will fit ${v < Number(row.dataset.chest) ? "looser" : "tighter"} than your tee. Ask us in the DM.`
      : `Size ${size} matches that measurement.`;
    echo.forEach((e) => (e.textContent = ` (${size})`));
    mail.forEach((a) => (a.href = `mailto:emksystem01@gmail.com?subject=${encodeURIComponent(`Order: Peace tee, size ${size}`)}&body=${encodeURIComponent(`Hi EMK SYSTEM, I'd like the Peace tee in size ${size}.`)}`));
  });
}
