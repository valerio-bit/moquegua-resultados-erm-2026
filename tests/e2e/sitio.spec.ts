import { expect, test } from "@playwright/test";

const SOURCE = "Fuente de datos electorales: Oficina Nacional de Procesos Electorales (ONPE)";

test.describe("Inicio", () => {
  test("muestra título, fuente, actualización y situación regional", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Resultados Electorales 2026 — Moquegua");
    await expect(page.getByTestId("source-line")).toHaveText(SOURCE);
    await expect(page.getByText("Última actualización")).toBeVisible();
    await expect(page.getByText("Avance de actas, gobierno regional")).toBeVisible();
    await expect(page.getByRole("heading", { name: /segunda vuelta/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Las tres provincias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alcaldías por partido" })).toBeVisible();
    await expect(page.getByTestId("participation-170000")).toBeVisible();
  });

  test("no presenta a nadie como autoridad electa por ir primero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Aún no hay gobernador electo")).toBeVisible();
    const body = (await page.locator("main").textContent()) ?? "";
    // Ninguna afirmación del tipo "X es/fue gobernador electo" o "alcalde electo/proclamado".
    expect(body).not.toMatch(/\b(es|fue|resultó|sería)\s+(el\s+|la\s+)?(nuevo\s+|nueva\s+)?(gobernador|gobernadora|alcalde|alcaldesa)\s+(electo|electa|proclamado|proclamada)/i);
    expect(body).not.toMatch(/(alcalde|alcaldesa|gobernador|gobernadora)\s+(electo|electa)\b(?!\s*:)/i);
    await expect(page.locator('[data-status="PROCLAMADO_JNE_JEE"]')).toHaveCount(0);
  });

  for (const term of ["Jakelin", "Blademir", "Prescilio", "Torata", "Pacocha"]) {
    test(`el buscador encuentra «${term}»`, async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("search-input").fill(term);
      const results = page.getByTestId("search-results");
      await expect(results).toBeVisible();
      await expect(results.getByRole("link").first()).toContainText(new RegExp(term, "i"));
    });
  }

  test("el buscador lleva al distrito", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("search-input").fill("pacocha");
    await page.getByTestId("search-results").getByRole("link", { name: /Pacocha/ }).first().click();
    await expect(page).toHaveURL(/\/distritos\/pacocha\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Distrito de Pacocha");
  });

  test("el selector territorial navega a provincia y distrito", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("province-select").selectOption("mariscal-nieto");
    await page.getByTestId("district-select").selectOption("torata");
    await page.getByRole("button", { name: "Ver resultados" }).click();
    await expect(page).toHaveURL(/\/distritos\/torata\/$/);
  });
});

test.describe("Gobierno Regional", () => {
  test("lista todas las fórmulas y marca la segunda vuelta", async ({ page }) => {
    await page.goto("/gobierno-regional/");
    const table = page.getByTestId("results-1-170000");
    await expect(table.locator("tbody tr")).toHaveCount(11);
    await expect(table.locator('[data-status="SEGUNDA_VUELTA"]')).toHaveCount(2);
    await expect(page.getByText("Segunda vuelta").first()).toBeVisible();
    await expect(table.locator("caption")).toContainText("11 fórmulas");
    await expect(page.getByRole("heading", { name: "Consejo Regional" })).toBeVisible();
    // Cada tabla tiene caption y encabezados
    for (const t of await page.locator("table").all()) await expect(t.locator("caption")).toHaveCount(1);
  });
});

const PROVINCES = [
  { slug: "mariscal-nieto", name: "Mariscal Nieto", candidate: /Jakelin/ },
  { slug: "general-sanchez-cerro", name: "General Sánchez Cerro", candidate: /Prescilio/ },
  { slug: "ilo", name: "Ilo", candidate: /Blademir/ },
];

for (const p of PROVINCES) {
  test(`Provincia ${p.name}: candidatos, distritos, participación`, async ({ page }) => {
    await page.goto(`/provincias/${p.slug}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Provincia de ${p.name}`);
    const tabs = page.getByRole("navigation", { name: "Provincias" });
    await expect(tabs.getByRole("link", { name: p.name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Todas las candidaturas provinciales" })).toBeVisible();
    await expect(page.locator("table").first()).toContainText(p.candidate);
    await expect(page.getByRole("heading", { name: `Distritos de ${p.name}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Participación y ausentismo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Consejo Regional en ${p.name}` })).toBeVisible();
  });
}

test("las pestañas de provincias cambian de provincia", async ({ page }) => {
  await page.goto("/provincias/");
  await page.getByRole("navigation", { name: "Provincias" }).getByRole("link", { name: "Ilo" }).click();
  await expect(page).toHaveURL(/\/provincias\/ilo\/$/);
});

test.describe("Distritos", () => {
  test("Torata muestra su alcaldía distrital", async ({ page }) => {
    await page.goto("/distritos/torata/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Distrito de Torata");
    await expect(page.getByTestId("results-4-170105").locator("tbody tr")).toHaveCount(8);
    await expect(page.getByRole("navigation", { name: "Ruta de navegación" })).toContainText("Mariscal Nieto");
  });

  test("una capital provincial no duplica la alcaldía", async ({ page }) => {
    await page.goto("/distritos/omate/");
    await expect(page.getByText("Capital de la provincia General Sánchez Cerro")).toBeVisible();
    await expect(page.locator('[data-testid^="results-4-"]')).toHaveCount(0);
  });

  test("Samegua se muestra como resultado parcial", async ({ page }) => {
    await page.goto("/distritos/samegua/");
    await expect(page.locator('[data-status="PARCIAL"]').first()).toBeVisible();
    await expect(page.locator('[data-status="PRIMER_LUGAR_VIRTUAL"]')).toHaveCount(0);
  });
});

test("Partidos: panel y ficha", async ({ page }) => {
  await page.goto("/partidos/");
  await expect(page.getByTestId("party-dashboard").locator("tbody tr")).toHaveCount(23);
  await page.getByTestId("party-dashboard").getByRole("link", { name: "Acción Popular" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acción Popular");
  await expect(page.getByText("Suma descriptiva de votos")).toBeVisible();
  await expect(page.getByAltText("Símbolo de Acción Popular").first()).toBeVisible();
});

test("Participación y ausentismo: región, provincias y distritos", async ({ page }) => {
  await page.goto("/participacion/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Participación y ausentismo");
  await expect(page.getByTestId("participation-table").locator("tbody tr")).toHaveCount(24);
  await expect(page.getByText(/Dato provisional: 300 electores/).first()).toBeVisible();
  await page.getByRole("button", { name: "Qué significa: ausentismo" }).first().click();
  await expect(page.getByRole("tooltip").filter({ hasText: "No confundir" })).toBeVisible();
});

test("Fuentes y metodología", async ({ page }) => {
  await page.goto("/fuentes-y-metodologia/");
  await expect(page.getByText(SOURCE).first()).toBeVisible();
  await expect(page.getByText(/AWS WAF/)).toBeVisible();
});

test("SEO: sitemap y robots", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/provincias/ilo/");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /actualizar/");
});

test("navegación por teclado: enlace para saltar al contenido", async ({ page, isMobile }) => {
  test.skip(isMobile, "solo escritorio");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
});
